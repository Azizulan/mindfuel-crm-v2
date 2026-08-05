import { handleApi, err } from '@/app/lib/api-helper';
import { Customer, Setting } from '@/app/lib/models';
import { scoreCustomer, DEFAULT_MAX_DORMANCY_DAYS } from '@/app/lib/helpers';
import { getCached, setCached, queueKey, todayStamp } from '@/app/lib/queueCache';

export const dynamic = 'force-dynamic';

// Only the most recent notes matter for scoring: the widest suppression window
// we evaluate is 60 days ("Not Interested ×2"), and the sentiment modifier only
// reads the latest note. Slicing server-side keeps an unbounded array from
// dominating the payload for long-tenured customers.
const NOTES_WINDOW = 40;

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId') || '';
    const size = Math.min(Math.max(Number(url.searchParams.get('size') || '50'), 1), 200);
    if (!agentId) return err('agentId is required');

    // Explicit refresh (the UI's Refresh button) bypasses the cache.
    const forceRefresh = url.searchParams.get('refresh') === '1';

    const now = new Date();
    const cacheKey = queueKey(agentId, size, todayStamp(now));

    if (!forceRefresh) {
      const hit = getCached<any>(cacheKey);
      if (hit) return { ...hit, cached: true };
    }

    // Optional admin-controlled segment filter (Settings → Queue Focus).
    // Empty / unset = no filter → use all eligible customers.
    const [focusSetting, convSetting, dormancySetting] = await Promise.all([
      Setting.findOne({ key: 'queue_focus_segments' }).lean(),
      Setting.findOne({ key: 'conversion_model' }).lean(),
      Setting.findOne({ key: 'queue_max_dormancy_days' }).lean(),
    ]);

    // Past this many days of silence a customer drops out of the daily queue
    // and belongs to the Win-Back lane instead. Tunable without a deploy.
    const rawDormancy = Number((dormancySetting as any)?.value);
    const maxDormancyDays =
      Number.isFinite(rawDormancy) && rawDormancy > 0 ? rawDormancy : DEFAULT_MAX_DORMANCY_DAYS;
    const focusSegments: string[] | null =
      Array.isArray((focusSetting as any)?.value) && (focusSetting as any).value.length > 0
        ? ((focusSetting as any).value as string[])
        : null;

    // Conversion model (Tier 1.2). Expected value = P(convert|segment) × avg
    // order value for this customer. Used to surface EV and nudge ranking.
    const convModel: any = (convSetting as any)?.value || null;
    const expectedValueFor = (doc: any): number => {
      if (!convModel) return 0;
      const seg = doc.rfmSegment;
      const p = (seg && convModel.ratesBySegment?.[seg] != null)
        ? convModel.ratesBySegment[seg]
        : (convModel.overallRate ?? 0);
      const aov = (doc.purchaseCount > 0 && doc.totalSpending > 0)
        ? doc.totalSpending / doc.purchaseCount
        : (convModel.avgOrderValue ?? 0);
      return p * aov;
    };

    const baseQuery: any = {
      $and: [
        { $or: [{ purchaseCount: { $gt: 0 } }, { 'followUpNotes.0': { $exists: true } }] },
        { $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }] },
      ],
    };
    if (focusSegments) baseQuery.rfmSegment = { $in: focusSegments };

    // Projection notes:
    //   - `purchases` is NOT loaded. The only thing the queue needed it for was
    //     the last-product label, which now lives on `lastProduct`.
    //   - `followUpNotes` is sliced to the most recent NOTES_WINDOW entries.
    //   - `_id` is dropped; this route keys off the business `id`.
    const candidates = await Customer.find(baseQuery, {
      _id: 0,
      id: 1, name: 1, phone: 1,
      totalSpending: 1, purchaseCount: 1, lastPurchaseDate: 1,
      lastProduct: 1,
      predictedReorderDays: 1, reorderConfidence: 1, nextOutreachDate: 1,
      rfmSegment: 1, rfmAction: 1, rScore: 1, fScore: 1, mScore: 1,
      bestCallHourStart: 1, bestCallHourEnd: 1, bestPickupRate: 1,
      bestCallConfidence: 1, bestCallSummary: 1,
      recommendedProduct: 1, recommendedProductReason: 1, recommendedProductLift: 1,
      followUpNotes: { $slice: -NOTES_WINDOW },
    }).lean();

    let suppressed = 0;
    const scored: any[] = [];
    const msPerDay = 86400000;

    for (const doc of candidates as any[]) {
      const notes = (doc.followUpNotes ?? []) as any[];

      const result = scoreCustomer(
        {
          id: doc.id,
          name: doc.name,
          phone: doc.phone,
          totalSpending: doc.totalSpending ?? 0,
          purchaseCount: doc.purchaseCount ?? 0,
          lastPurchaseDate: doc.lastPurchaseDate,
          followUpNotes: notes.map((n: any) => ({
            date: n.date, feedback: n.feedback, agent: n.agent, reminderDate: n.reminderDate ?? null,
          })),
          predictedReorderDays: doc.predictedReorderDays ?? null,
          reorderConfidence:    doc.reorderConfidence    ?? 'none',
          rfmSegment:           doc.rfmSegment           ?? undefined,
        },
        agentId,
        now,
        { maxDormancyDays }
      );

      if (result.suppressed) { suppressed++; continue; }

      // Expected value = P(convert) × avg order value (Tier 1.2). Decayed by
      // the same recency factor as the base score — otherwise a dormant whale's
      // EV would float free of the dormancy discount and undo it.
      const expectedValue = expectedValueFor(doc);
      const evBoost = Math.min(Math.round(expectedValue / 20), 60) * result.recencyFactor;

      // Notes are stored in insertion order, so the newest is last — no need to
      // copy and re-sort the array for every candidate.
      const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;

      scored.push({
        id: doc.id, name: doc.name, phone: doc.phone,
        score: Math.round(result.score + evBoost), reason: result.reason,
        expectedValue: Math.round(expectedValue),
        recencyFactor: Math.round(result.recencyFactor * 100) / 100,
        lastSentiment: latestNote?.feedback ?? null,
        daysSinceLastCall: latestNote ? Math.floor((now.getTime() - new Date(latestNote.date).getTime()) / msPerDay) : null,
        daysSinceLastOrder: doc.lastPurchaseDate ? Math.floor((now.getTime() - new Date(doc.lastPurchaseDate).getTime()) / msPerDay) : null,
        totalSpending: doc.totalSpending, purchaseCount: doc.purchaseCount,
        // Personalised reorder cycle, surfaced to the queue card UI.
        predictedReorderDays: doc.predictedReorderDays ?? null,
        reorderConfidence:    doc.reorderConfidence    ?? 'none',
        reorderStatus:        result.reorderStatus     ?? null,
        daysVsReorder:        result.daysVsReorder     ?? null,
        // RFM segment + recommended action (Tier 1.6).
        rfmSegment:           doc.rfmSegment           ?? null,
        rfmAction:            doc.rfmAction            ?? null,
        // Best call time (Tier 1.4) — only meaningful at medium+ confidence.
        bestCallSummary:      doc.bestCallSummary      ?? '',
        bestCallConfidence:   doc.bestCallConfidence   ?? 'none',
        bestCallHourStart:    doc.bestCallHourStart    ?? null,
        bestCallHourEnd:      doc.bestCallHourEnd      ?? null,
        // Best next product to pitch (Tier 1.3).
        recommendedProduct:       doc.recommendedProduct       ?? null,
        recommendedProductReason: doc.recommendedProductReason ?? null,
        recommendedProductLift:   doc.recommendedProductLift   ?? 0,
        // Most recent product — precomputed on write (recalculateCustomerStats).
        lastProduct:              doc.lastProduct              ?? null,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    const payload = {
      queue: scored.slice(0, size),
      suppressed,
      totalEligible: scored.length,
      generatedAt: now.toISOString(),
      // Helps the UI tell agents which campaign is active without surprising them.
      focusSegments: focusSegments ?? [],
    };

    setCached(cacheKey, payload);
    return { ...payload, cached: false };
  });
}
