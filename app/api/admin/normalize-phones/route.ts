import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { normalizePhone } from '@/app/lib/helpers';

export const dynamic = 'force-dynamic';

// Tier 3.12 — one-shot admin route. Idempotent.
//
//   POST /api/admin/normalize-phones
//
// 1. Backfills `normalizedPhone` (last 10 digits of `phone`) for every customer
//    that doesn't have it set.
// 2. Returns a report of duplicate customers (same normalised phone) so the
//    admin can review and merge them manually — auto-merging is too risky
//    (whose name wins? whose purchase history is canonical?).
export async function POST() {
  return handleApi(async () => {
    // ── 1. Backfill ──────────────────────────────────────────────────────────
    const cursor = Customer.find(
      {},
      { _id: 1, phone: 1, normalizedPhone: 1 }
    ).cursor();

    const ops: any[] = [];
    let processed = 0;
    let updated = 0;
    let invalid = 0;

    for await (const doc of cursor) {
      processed++;
      const normalized = normalizePhone((doc as any).phone);
      if (normalized.length < 10) {
        invalid++;
        continue;
      }
      if ((doc as any).normalizedPhone === normalized) continue;

      ops.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: { $set: { normalizedPhone: normalized } },
        },
      });
      updated++;

      if (ops.length >= 500) {
        await Customer.bulkWrite(ops, { ordered: false });
        ops.length = 0;
      }
    }
    if (ops.length > 0) await Customer.bulkWrite(ops, { ordered: false });

    // ── 2. Duplicate detection ───────────────────────────────────────────────
    // Aggregate to find phones with >1 customer record.
    const duplicates = await Customer.aggregate([
      { $match: { normalizedPhone: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$normalizedPhone',
          count: { $sum: 1 },
          customers: {
            $push: {
              id:            '$id',
              name:          '$name',
              phone:         '$phone',
              purchaseCount: '$purchaseCount',
              totalSpending: '$totalSpending',
              lastPurchaseDate: '$lastPurchaseDate',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
    ]);

    return {
      message: `Normalised ${updated} customer phones (${processed} total, ${invalid} with phones too short to normalise). Found ${duplicates.length} groups of duplicates.`,
      processed,
      updated,
      invalid,
      duplicateGroupCount: duplicates.length,
      // First 200 dup groups, useful for an admin to review and merge.
      duplicates: duplicates.map(d => ({
        normalizedPhone: d._id,
        count: d.count,
        customers: d.customers,
      })),
    };
  });
}
