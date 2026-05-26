import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { computeReorderCycle, computeRFM } from '@/app/lib/helpers';

export const dynamic = 'force-dynamic';

// One-shot admin route: recomputes both the per-customer reorder cycle
// (Tier 1.1) and the RFM segment (Tier 1.6) for every customer based on
// their existing purchase history.
//
// Safe to call repeatedly — it's idempotent. Returns segment distribution
// so the admin can sanity-check the classification.
//
//   POST /api/admin/recompute-reorder
export async function POST() {
  return handleApi(async () => {
    const cursor = Customer.find(
      {},
      { _id: 1, purchases: 1, lastPurchaseDate: 1, purchaseCount: 1, totalSpending: 1 }
    ).cursor();

    const ops: any[] = [];
    let processed = 0;
    let withCycle = 0;
    const segmentCounts: Record<string, number> = {};

    for await (const doc of cursor) {
      const cycle = computeReorderCycle((doc as any).purchases ?? []);
      const rfm   = computeRFM({
        lastPurchaseDate: (doc as any).lastPurchaseDate,
        purchaseCount:    (doc as any).purchaseCount ?? 0,
        totalSpending:    (doc as any).totalSpending ?? 0,
      });

      ops.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: {
            $set: {
              predictedReorderDays: cycle.predictedReorderDays,
              nextOutreachDate:     cycle.nextOutreachDate,
              reorderConfidence:    cycle.reorderConfidence,
              rScore:     rfm.rScore,
              fScore:     rfm.fScore,
              mScore:     rfm.mScore,
              rfmSegment: rfm.rfmSegment,
              rfmAction:  rfm.rfmAction,
            },
          },
        },
      });

      processed++;
      if (cycle.predictedReorderDays !== null) withCycle++;
      segmentCounts[rfm.rfmSegment] = (segmentCounts[rfm.rfmSegment] || 0) + 1;

      if (ops.length >= 500) {
        await Customer.bulkWrite(ops, { ordered: false });
        ops.length = 0;
      }
    }
    if (ops.length > 0) await Customer.bulkWrite(ops, { ordered: false });

    return {
      message: `Recomputed cycle + RFM for ${processed} customers (${withCycle} got a personalised reorder window).`,
      processed,
      withCycle,
      segmentDistribution: segmentCounts,
    };
  });
}
