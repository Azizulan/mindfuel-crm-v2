import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder, Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const now = new Date();
    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth  = new Date(startOfMonth.getTime() - 1);
    const dayOfMonth      = now.getDate();
    const daysInMonth     = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthLabel      = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const prevMonthLabel  = startOfPrevMonth.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    const [monthOrdersAgg, notesThisMonth, notesPrevMonth, revenueTargetRes, ordersTargetRes] = await Promise.all([
      // Daily order revenue & count this month
      LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id:     { $dayOfMonth: '$createdAt' },
            revenue: { $sum: '$cod_amount' },
            orders:  { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // This month's call notes (for calls-per-day and sentiment)
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: startOfMonth } } },
        {
          $project: {
            _id: 0,
            feedback:    '$followUpNotes.feedback',
            day:         { $dayOfMonth: '$followUpNotes.date' },
            valueRating: '$valueRating',
          },
        },
      ]),
      // Previous month's notes for sentiment funnel comparison
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
        { $project: { _id: 0, feedback: '$followUpNotes.feedback' } },
      ]),
      Setting.findOne({ key: 'monthly_revenue_target' }),
      Setting.findOne({ key: 'monthly_orders_target' }),
    ]);

    const revenueMTD  = monthOrdersAgg.reduce((s: number, d: any) => s + d.revenue, 0);
    const ordersMTD   = monthOrdersAgg.reduce((s: number, d: any) => s + d.orders, 0);
    const revenueTarget = revenueTargetRes ? Number(revenueTargetRes.value) : 0;
    const ordersTarget  = ordersTargetRes  ? Number(ordersTargetRes.value)  : 0;

    // Build per-day data
    const orderDayMap: Record<number, { revenue: number; orders: number }> = {};
    for (const o of monthOrdersAgg) orderDayMap[o._id] = { revenue: o.revenue, orders: o.orders };
    const callDayMap: Record<number, number> = {};
    for (const n of notesThisMonth) callDayMap[n.day] = (callDayMap[n.day] || 0) + 1;

    const dailyData = Array.from({ length: dayOfMonth }, (_, i) => ({
      day:     i + 1,
      isToday: i + 1 === dayOfMonth,
      revenue: orderDayMap[i + 1]?.revenue || 0,
      orders:  orderDayMap[i + 1]?.orders  || 0,
      calls:   callDayMap[i + 1]           || 0,
    }));

    // Sentiment funnels
    const buildFunnel = (notes: any[], label: string) => {
      const totalCalls    = notes.length;
      const positiveCalls = notes.filter((n: any) => ['Happy', 'Positive'].includes(n.feedback)).length;
      return {
        label,
        totalCalls,
        positiveCalls,
        convRate: totalCalls > 0 ? Math.round((positiveCalls / totalCalls) * 100) : 0,
      };
    };

    // Segment performance (grouped by valueRating)
    const segMap: Record<string, { called: number; happy: number }> = {};
    for (const n of notesThisMonth) {
      const seg = n.valueRating || 'Unrated';
      if (!segMap[seg]) segMap[seg] = { called: 0, happy: 0 };
      segMap[seg].called++;
      if (['Happy', 'Positive'].includes(n.feedback)) segMap[seg].happy++;
    }
    const segmentPerformance = Object.entries(segMap)
      .map(([segment, s]) => ({
        segment,
        customersCalled: s.called,
        happyRate: s.called > 0 ? Math.round((s.happy / s.called) * 100) : 0,
        orderRate: 0,
        revenue:   0,
      }))
      .sort((a, b) => b.customersCalled - a.customersCalled);

    return {
      monthLabel,
      revenueMTD,
      revenueTarget,
      ordersMTD,
      ordersTarget,
      dayOfMonth,
      daysInMonth,
      newCustomersMTD:    0,
      repeatCustomersMTD: 0,
      dailyData,
      sentimentFunnel: {
        current:  buildFunnel(notesThisMonth, monthLabel),
        previous: buildFunnel(notesPrevMonth, prevMonthLabel),
      },
      segmentPerformance,
      anomalies: [],
    };
  });
}
