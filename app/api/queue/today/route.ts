import { handleApi, err } from '@/app/lib/api-helper';
import { Customer, Setting } from '@/app/lib/models';
import { scoreCustomer } from '@/app/lib/helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId') || '';
    const size = Math.min(Math.max(Number(url.searchParams.get('size') || '50'), 1), 200);
    if (!agentId) return err('agentId is required');

    const now = new Date();

    // Optional admin-controlled segment filter (Settings → Queue Focus).
    // Empty / unset = no filter → use all eligible customers.
    const focusSetting = await Setting.findOne({ key: 'queue_focus_segments' });
    const focusSegments: string[] | null =
      Array.isArray(focusSetting?.value) && focusSetting!.value.length > 0
        ? (focusSetting!.value as string[])
        : null;

    const baseQuery: any = {
      $and: [
        { $or: [{ purchaseCount: { $gt: 0 } }, { 'followUpNotes.0': { $exists: true } }] },
        { $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }] },
      ],
    };
    if (focusSegments) baseQuery.rfmSegment = { $in: focusSegments };

    const candidates = await Customer.find(baseQuery)
      .select('id name phone totalSpending purchaseCount lastPurchaseDate followUpNotes predictedReorderDays reorderConfidence nextOutreachDate rfmSegment rfmAction rScore fScore mScore bestCallHourStart bestCallHourEnd bestPickupRate bestCallConfidence bestCallSummary recommendedProduct recommendedProductReason recommendedProductLift')
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

      const notes = (doc.followUpNotes ?? []) as any[];
      const sortedNotes = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestNote = sortedNotes[0] ?? null;
      scored.push({
        id: doc.id, name: doc.name, phone: doc.phone,
        score: result.score, reason: result.reason,
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
