import { handleApi, err } from '@/app/lib/api-helper';
import { Customer, Setting } from '@/app/lib/models';
import { scoreCustomer } from '@/app/lib/helpers';

export const dynamic = 'force-dynamic';

// Most recent real product (skips the generic Steadfast fallback) — used by
// the in-call script panel for "আপনার <product>".
function deriveLastProduct(purchases: any[]): string | null {
  if (!purchases?.length) return null;
  const sorted = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const p of sorted) {
    const name = String(p.product || '').trim();
    const low = name.toLowerCase();
    if (name && low !== 'steadfast delivery' && low !== 'unknown') return name;
  }
  return null;
}

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId') || '';
    const size = Math.min(Math.max(Number(url.searchParams.get('size') || '50'), 1), 200);
    if (!agentId) return err('agentId is required');

    const now = new Date();

    // Optional admin-controlled segment filter (Settings → Queue Focus).
    // Empty / unset = no filter → use all eligible customers.
    const [focusSetting, convSetting] = await Promise.all([
      Setting.findOne({ key: 'queue_focus_segments' }),
      Setting.findOne({ key: 'conversion_model' }),
    ]);
    const focusSegments: string[] | null =
      Array.isArray(focusSetting?.value) && focusSetting!.value.length > 0
        ? (focusSetting!.value as string[])
        : null;

    // Conversion model (Tier 1.2). Expected value = P(convert|segment) × avg
    // order value for this customer. Used to surface EV and nudge ranking.
    const convModel: any = convSetting?.value || null;
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

    const candidates = await Customer.find(baseQuery)
      .select('id name phone totalSpending purchaseCount lastPurchaseDate followUpNotes purchases predictedReorderDays reorderConfidence nextOutreachDate rfmSegment rfmAction rScore fScore mScore bestCallHourStart bestCallHourEnd bestPickupRate bestCallConfidence bestCallSummary recommendedProduct recommendedProductReason recommendedProductLift')
      .lean();

    let suppressed = 0;
    const scored: any[] = [];
    const msPerDay = 86400000;

    for (const doc of candidates) {
      const result = scoreCustomer(
        {
          id: doc.id,
          name: doc.name,
          phone: doc.phone,
          totalSpending: doc.totalSpending ?? 0,
          purchaseCount: doc.purchaseCount ?? 0,
          lastPurchaseDate: doc.lastPurchaseDate,
          followUpNotes: (doc.followUpNotes ?? []).map((n: any) => ({
            date: n.date, feedback: n.feedback, agent: n.agent, reminderDate: n.reminderDate ?? null,
          })),
          predictedReorderDays: (doc as any).predictedReorderDays ?? null,
          reorderConfidence:    (doc as any).reorderConfidence    ?? 'none',
          rfmSegment:           (doc as any).rfmSegment           ?? undefined,
        },
        agentId,
        now
      );

      if (result.suppressed) { suppressed++; continue; }

      // Expected value = P(convert) × avg order value (Tier 1.2). Nudge the
      // score so high-EV customers rise, without overriding the urgency
      // signals (reorder window, suppression, etc.).
      const expectedValue = expectedValueFor(doc);
      const evBoost = Math.min(Math.round(expectedValue / 20), 60);

      const notes = (doc.followUpNotes ?? []) as any[];
      const sortedNotes = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestNote = sortedNotes[0] ?? null;
      scored.push({
        id: doc.id, name: doc.name, phone: doc.phone,
        score: result.score + evBoost, reason: result.reason,
        expectedValue: Math.round(expectedValue),
        lastSentiment: latestNote?.feedback ?? null,
        daysSinceLastCall: latestNote ? Math.floor((now.getTime() - new Date(latestNote.date).getTime()) / msPerDay) : null,
        daysSinceLastOrder: doc.lastPurchaseDate ? Math.floor((now.getTime() - new Date(doc.lastPurchaseDate).getTime()) / msPerDay) : null,
        totalSpending: doc.totalSpending, purchaseCount: doc.purchaseCount,
        // Personalised reorder cycle, surfaced to the queue card UI.
        predictedReorderDays: (doc as any).predictedReorderDays ?? null,
        reorderConfidence:    (doc as any).reorderConfidence    ?? 'none',
        reorderStatus:        result.reorderStatus              ?? null,
        daysVsReorder:        result.daysVsReorder              ?? null,
        // RFM segment + recommended action (Tier 1.6).
        rfmSegment:           (doc as any).rfmSegment           ?? null,
        rfmAction:            (doc as any).rfmAction            ?? null,
        // Best call time (Tier 1.4) — only meaningful at medium+ confidence.
        bestCallSummary:      (doc as any).bestCallSummary      ?? '',
        bestCallConfidence:   (doc as any).bestCallConfidence   ?? 'none',
        bestCallHourStart:    (doc as any).bestCallHourStart    ?? null,
        bestCallHourEnd:      (doc as any).bestCallHourEnd      ?? null,
        // Best next product to pitch (Tier 1.3).
        recommendedProduct:       (doc as any).recommendedProduct       ?? null,
        recommendedProductReason: (doc as any).recommendedProductReason ?? null,
        recommendedProductLift:   (doc as any).recommendedProductLift   ?? 0,
        // Most recent product — for the in-call script panel.
        lastProduct:              deriveLastProduct((doc as any).purchases),
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return {
      queue: scored.slice(0, size),
      suppressed,
      totalEligible: scored.length,
      generatedAt: now.toISOString(),
      // Helps the UI tell agents which campaign is active without surprising them.
      focusSegments: focusSegments ?? [],
    };
  });
}
