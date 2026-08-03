import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

// ─── Courier delivery density, per calendar day ──────────────────────────────
//
// Answers "how many Steadfast deliveries do we hold for each date?" straight
// from our own data — no courier API calls, so it renders instantly.
//
// On its own this CANNOT tell you whether a date is missing: a day with zero
// deliveries looks identical whether it was never synced or genuinely had no
// business. Pair it with POST /api/sync/reconcile, which diffs against
// Steadfast itself, for the authoritative answer.
//
//   GET /api/sync/coverage?start=2026-02-01&end=2026-07-31

const TZ = process.env.CRM_TIMEZONE || 'Asia/Dhaka';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end   = url.searchParams.get('end');

    const match: any = {
      'purchases.steadfastId': { $exists: true, $nin: [null, ''] },
    };
    if (start || end) {
      match['purchases.date'] = {};
      if (start) match['purchases.date'].$gte = new Date(start + 'T00:00:00.000Z');
      if (end)   match['purchases.date'].$lte = new Date(end   + 'T23:59:59.999Z');
    }

    const rows = await Customer.aggregate([
      // Narrow to customers with courier purchases before unwinding — without
      // this the unwind fans out the entire collection.
      { $match: { 'purchases.steadfastId': { $exists: true, $nin: [null, ''] } } },
      { $unwind: '$purchases' },
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchases.date', timezone: TZ } },
          deliveries: { $sum: 1 },
          revenue: { $sum: '$purchases.amount' },
          // A consignment id should appear exactly once. If the set is smaller
          // than the count, the same id got stored twice — a dedupe failure.
          distinctIds: { $addToSet: '$purchases.steadfastId' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          deliveries: 1,
          revenue: { $round: ['$revenue', 0] },
          distinct: { $size: '$distinctIds' },
        },
      },
      { $sort: { date: 1 } },
    ]).allowDiskUse(true);

    const totals = rows.reduce(
      (acc: any, r: any) => {
        acc.deliveries += r.deliveries;
        acc.revenue    += r.revenue;
        acc.duplicates += r.deliveries - r.distinct;
        return acc;
      },
      { deliveries: 0, revenue: 0, duplicates: 0 }
    );

    return {
      days: rows,
      firstDate: rows.length ? rows[0].date : null,
      lastDate:  rows.length ? rows[rows.length - 1].date : null,
      daysWithData: rows.length,
      timezone: TZ,
      ...totals,
    };
  });
}
