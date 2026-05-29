import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const [totalCustomers, revenueAgg, lifecycleAgg, topProductsAgg, monthlyTrendAgg, riskAgg] = await Promise.all([
      Customer.countDocuments(),

      // Total revenue + customers who have purchased
      Customer.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalSpending' },
            withPurchase: { $sum: { $cond: [{ $gt: ['$purchaseCount', 0] }, 1, 0] } },
          },
        },
      ]),

      // Lifecycle tier counts
      Customer.aggregate([
        {
          $group: {
            _id: null,
            vip:      { $sum: { $cond: [{ $gte: ['$purchaseCount', 5] }, 1, 0] } },
            loyal:    { $sum: { $cond: [{ $and: [{ $gte: ['$purchaseCount', 3] }, { $lt: ['$purchaseCount', 5] }] }, 1, 0] } },
            repeat:   { $sum: { $cond: [{ $eq:  ['$purchaseCount', 2] }, 1, 0] } },
            oneTime:  { $sum: { $cond: [{ $eq:  ['$purchaseCount', 1] }, 1, 0] } },
            outreach: { $sum: { $cond: [{ $eq:  ['$purchaseCount', 0] }, 1, 0] } },
          },
        },
      ]),

      // Top 10 products by revenue
      Customer.aggregate([
        { $unwind: '$purchases' },
        {
          $group: {
            _id:       '$purchases.product',
            orders:    { $sum: 1 },
            revenue:   { $sum: '$purchases.amount' },
            customers: { $addToSet: '$id' },
          },
        },
        {
          $project: {
            name:      '$_id',
            orders:    1,
            revenue:   1,
            customers: { $size: '$customers' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      // Monthly revenue + order trend (all time, sorted)
      Customer.aggregate([
        { $unwind: '$purchases' },
        {
          $group: {
            _id:     { year: { $year: '$purchases.date' }, month: { $month: '$purchases.date' } },
            revenue: { $sum: '$purchases.amount' },
            orders:  { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // Revenue at risk + already lost, grouped by churn-relevant RFM segment (Tier 2.9).
      Customer.aggregate([
        { $match: { rfmSegment: { $in: ['At Risk', "Can't Lose", 'Lost'] } } },
        { $group: { _id: '$rfmSegment', count: { $sum: 1 }, value: { $sum: '$totalSpending' } } },
      ]),
    ]);

    const totalRevenue   = revenueAgg[0]?.totalRevenue || 0;
    const withPurchase   = revenueAgg[0]?.withPurchase || 0;
    const avgLTV         = withPurchase > 0 ? Math.round(totalRevenue / withPurchase) : 0;

    const lc = lifecycleAgg[0] || { vip: 0, loyal: 0, repeat: 0, oneTime: 0, outreach: 0 };
    const repeatCount        = (lc.vip || 0) + (lc.loyal || 0) + (lc.repeat || 0);
    const repeatPurchaseRate = totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100) : 0;

    // Tier 2.9 — revenue at risk (recoverable) vs. already lost.
    const riskMap: Record<string, { count: number; value: number }> = {};
    for (const r of riskAgg) riskMap[r._id] = { count: r.count, value: r.value || 0 };
    const atRisk    = riskMap['At Risk']    || { count: 0, value: 0 };
    const cantLose  = riskMap["Can't Lose"] || { count: 0, value: 0 };
    const lost      = riskMap['Lost']       || { count: 0, value: 0 };
    const revenueAtRisk = {
      recoverableValue: atRisk.value + cantLose.value,   // At Risk + Can't Lose — still saveable
      recoverableCount: atRisk.count + cantLose.count,
      cantLoseValue:    cantLose.value,
      cantLoseCount:    cantLose.count,
      lostValue:        lost.value,                       // already churned
      lostCount:        lost.count,
    };

    const monthlyTrend = monthlyTrendAgg.map((m: any) => ({
      month:          `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
      revenue:        m.revenue,
      orders:         m.orders,
      newCustomers:   0,
      repeatCustomers: 0,
    }));

    return {
      totalCustomers,
      avgLTV,
      totalRevenue,
      repeatPurchaseRate,
      avgReorderCycle:     null,
      lifecycle: {
        vip:      lc.vip      || 0,
        loyal:    lc.loyal    || 0,
        repeat:   lc.repeat   || 0,
        oneTime:  lc.oneTime  || 0,
        outreach: lc.outreach || 0,
      },
      revenueConcentration: [],
      variantBuckets:       null,
      revenueAtRisk,
      monthlyTrend,
      topProducts: topProductsAgg.map((p: any) => ({
        name:      p.name      || 'Unknown',
        customers: p.customers || 0,
        orders:    p.orders    || 0,
        revenue:   p.revenue   || 0,
      })),
    };
  });
}
