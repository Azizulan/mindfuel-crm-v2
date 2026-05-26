import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

// Returns { "Champion": 41, "Loyal": 182, ... } — used by the Settings page
// to show population counts next to each segment checkbox.
export async function GET() {
  return handleApi(async () => {
    const agg = await Customer.aggregate([
      { $group: { _id: '$rfmSegment', count: { $sum: 1 } } },
    ]);
    const result: Record<string, number> = {};
    for (const row of agg) {
      // Customers that haven't been backfilled yet bucket as "Unclassified"
      // so the admin sees they need to run the recompute.
      result[(row._id as string) || 'Unclassified'] = row.count;
    }
    return result;
  });
}
