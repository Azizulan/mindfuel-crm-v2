import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

// Tier 1.5 — Win-back / "Save Squad" queue.
//
// Surfaces the customers most worth saving: those in the actionable churning
// RFM segments (At Risk, Can't Lose), ranked by the revenue you're about to
// lose. Each carries the recommended action + best call time so an agent can
// run a save campaign straight off this list.
//
//   GET /api/queue/winback?size=50
export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const size = Math.min(Math.max(Number(url.searchParams.get('size') || '50'), 1), 200);
    const now = new Date();
    const msPerDay = 86_400_000;

    const candidates = await Customer.find({
      rfmSegment: { $in: ['At Risk', "Can't Lose"] },
      $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }],
    })
      .select('id name phone totalSpending purchaseCount lastPurchaseDate predictedReorderDays rfmSegment rfmAction recommendedProduct recommendedProductReason followUpNotes bestCallSummary bestCallConfidence')
      .lean();

    const customers = candidates.map((c: any) => {
      const dso = c.lastPurchaseDate
        ? Math.floor((now.getTime() - new Date(c.lastPurchaseDate).getTime()) / msPerDay)
        : null;
      const daysOverCycle = dso !== null && c.predictedReorderDays ? dso - c.predictedReorderDays : null;
      const notes = (c.followUpNotes ?? []) as any[];
      const lastNote = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const lastContactDays = lastNote
        ? Math.floor((now.getTime() - new Date(lastNote.date).getTime()) / msPerDay)
        : null;

      return {
        id: c.id, name: c.name, phone: c.phone,
        rfmSegment: c.rfmSegment, rfmAction: c.rfmAction,
        totalSpending: c.totalSpending || 0,
        purchaseCount: c.purchaseCount || 0,
        daysSinceLastOrder: dso,
        predictedReorderDays: c.predictedReorderDays ?? null,
        daysOverCycle,
        lastSentiment: lastNote?.feedback ?? null,
        lastContactDays,
        recommendedProduct: c.recommendedProduct ?? null,
        recommendedProductReason: c.recommendedProductReason ?? null,
        bestCallSummary: (c.bestCallConfidence === 'high' || c.bestCallConfidence === 'medium') ? (c.bestCallSummary || '') : '',
        valueAtRisk: c.totalSpending || 0,
      };
    });

    // Highest historical value first — that's the revenue most worth saving.
    // "Can't Lose" outranks "At Risk" at equal value.
    customers.sort((a, b) => {
      if (a.rfmSegment !== b.rfmSegment) return a.rfmSegment === "Can't Lose" ? -1 : 1;
      return b.valueAtRisk - a.valueAtRisk;
    });

    const totalValueAtRisk = customers.reduce((s, c) => s + c.valueAtRisk, 0);
    const cantLoseCount = customers.filter(c => c.rfmSegment === "Can't Lose").length;

    return {
      customers: customers.slice(0, size),
      count: customers.length,
      cantLoseCount,
      totalValueAtRisk,
      generatedAt: now.toISOString(),
    };
  });
}
