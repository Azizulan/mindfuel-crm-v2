import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { computeReorderCycle } from '@/app/lib/helpers';

export const dynamic = 'force-dynamic';

// One-shot admin route: recomputes predictedReorderDays / nextOutreachDate /
// reorderConfidence for every customer based on their existing purchases array.
// Safe to call repeatedly — it's idempotent.
//
// POST /api/admin/recompute-reorder
export async function POST() {
  return handleApi(async () => {
    const cursor = Customer.find({}, { _id: 1, purchases: 1 }).cursor();
    const ops: any[] = [];
    let processed = 0;
    let withCycle = 0;

    for await (const doc of cursor) {
      const cycle = computeReorderCycle((doc as any).purchases ?? []);
      ops.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: {
            $set: {
              predictedReorderDays: cycle.predictedReorderDays,
              nextOutreachDate:     cycle.nextOutreachDate,
              reorderConfidence:    cycle.reorderConfidence,
            },
          },
        },
      });
      processed++;
      if (cycle.predictedReorderDays !== null) withCycle++;

      // Flush in batches of 500 so we don't buffer the whole collection.
      if (ops.length >= 500) {
        await Customer.bulkWrite(ops, { ordered: false });
        ops.length = 0;
      }
    }
    if (ops.length > 0) await Customer.bulkWrite(ops, { ordered: false });

    return {
      message: `Recomputed reorder cycles for ${processed} customers (${withCycle} got a personalised window).`,
      processed,
      withCycle,
    };
  });
}
