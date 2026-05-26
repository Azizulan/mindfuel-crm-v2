import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder, Setting, User } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const agentName = url.searchParams.get('agent') || '';
    const activityDateParam = url.searchParams.get('activityDate') || '';

    const now = new Date();
    const gmtRes = await Setting.findOne({ key: 'gmt_offset' });
    const gmtOffset = gmtRes ? Number(gmtRes.value) : 6;
    const tzString = gmtOffset >= 0
      ? `+${String(gmtOffset).padStart(2, '0')}:00`
      : `-${String(Math.abs(gmtOffset)).padStart(2, '0')}:00`;

    let startOfActivity: Date, endOfActivity: Date;
    if (activityDateParam) {
      const d = new Date(activityDateParam);
      startOfActivity = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      endOfActivity   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    } else {
      startOfActivity = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endOfActivity   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [rangeStartDoc, rangeEndDoc] = await Promise.all([
      Setting.findOne({ key: 'outreach_range_start' }),
      Setting.findOne({ key: 'outreach_range_end' }),
    ]);
    const sDays = rangeStartDoc ? Number(rangeStartDoc.value) : 32;
    const eDays = rangeEndDoc ? Number(rangeEndDoc.value) : 28;
    const minDate = new Date(); minDate.setDate(now.getDate() - sDays); minDate.setHours(0,0,0,0);
    const maxDate = new Date(); maxDate.setDate(now.getDate() - eDays); maxDate.setHours(23,59,59,999);

    const [totalCustomers, repeatBuyers, followUpCount, totalOrderCount] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ purchaseCount: { $gt: 1 } }),
      Customer.countDocuments({ lastPurchaseDate: { $gte: minDate, $lte: maxDate } }),
      LocalOrder.countDocuments({ createdAt: { $gte: startOfMonth }, status: 'sent_to_courier' }),
    ]);

    const hourlyAgg = await Customer.aggregate([
      { $unwind: '$followUpNotes' },
      { $match: { 'followUpNotes.date': { $gte: startOfActivity, $lte: endOfActivity }, 'followUpNotes.feedback': { $ne: 'Call Not Received' } } },
      { $group: { _id: { agent: '$followUpNotes.agent', hour: { $hour: { date: '$followUpNotes.date', timezone: tzString } } }, count: { $sum: 1 } } },
      { $sort: { '_id.hour': 1 } },
    ]);

    const allExecs = await User.find({ role: 'Sales Executive' });
    const activityMap: Record<string, any> = {};
    allExecs.forEach(u => {
      activityMap[u.name] = {
        agentName: u.name, shiftStart: u.shiftStart, shiftEnd: u.shiftEnd, startHour: u.shiftStart,
        hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
        totalToday: 0, isCurrentlyLow: false,
      };
    });
    hourlyAgg.forEach((item: any) => {
      const a = activityMap[item._id.agent];
      if (a) { a.hourlyBreakdown[item._id.hour].count = item.count; a.totalToday += item.count; }
    });

    const currentHour = (now.getUTCHours() + gmtOffset + 24) % 24;
    const isToday = !activityDateParam || activityDateParam === now.toISOString().split('T')[0];
    const teamActivity = Object.values(activityMap).map((a: any) => {
      const inShift = currentHour >= a.shiftStart && currentHour < a.shiftEnd;
      a.isCurrentlyLow = isToday && inShift && a.hourlyBreakdown[currentHour].count < 10;
      return a;
    });

    let totalOutreachCount = 0;
    try {
      const r = await Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: startOfMonth }, 'followUpNotes.feedback': { $ne: 'Call Not Received' } } },
        { $group: { _id: '$id' } },
        { $count: 'total' },
      ]);
      totalOutreachCount = r[0]?.total || 0;
    } catch {}

    const leaderboard = await LocalOrder.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, agent: { $exists: true, $ne: null } } },
      { $group: { _id: '$agent', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
      { $project: { name: '$_id', count: 1, _id: 0 } },
    ]);

    let agentPerformance = null;
    if (agentName) {
      const conversions = await LocalOrder.countDocuments({ agent: agentName, createdAt: { $gte: startOfMonth } });
      const agentAct = activityMap[agentName];
      agentPerformance = {
        monthlyConversions: conversions,
        outreachToday: agentAct?.totalToday || 0,
        outreachThisHour: agentAct?.hourlyBreakdown[currentHour].count || 0,
        isCurrentlyLow: isToday && !!agentAct?.isCurrentlyLow,
      };
    }

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
    const [revenueData, bestSellers, recentActivity] = await Promise.all([
      Customer.aggregate([
        { $unwind: '$purchases' }, { $match: { 'purchases.date': { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchases.date' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }, { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),
      Customer.aggregate([
        { $unwind: '$purchases' }, { $group: { _id: '$purchases.product', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 }, { $project: { name: '$_id', count: 1, _id: 0 } },
      ]),
      Customer.aggregate([
        { $match: { 'followUpNotes.0': { $exists: true } } }, { $unwind: '$followUpNotes' },
        { $sort: { 'followUpNotes.date': -1 } }, { $limit: 8 },
        { $project: { customerName: '$name', customerId: '$id', feedback: '$followUpNotes.feedback', agent: '$followUpNotes.agent', date: '$followUpNotes.date' } },
      ]),
    ]);

    let valueTrend: any = { monthly: [] }, segmentTrend: any = { monthly: [] };
    if (totalCustomers > 0) {
      try {
        const trendPipeline = (format: string, type: 'rating' | 'isRepeat'): any[] => ([
          { $match: { lastPurchaseDate: { $exists: true, $ne: null } } },
          { $group: { _id: { period: { $dateToString: { format, date: '$lastPurchaseDate' } }, metric: type === 'rating' ? '$valueRating' : { $gt: ['$purchaseCount', 1] } }, count: { $sum: 1 } } },
          { $sort: { '_id.period': 1 } },
        ]);
        const [ratingData, segmentData] = await Promise.all([
          Customer.aggregate(trendPipeline('%Y-%m', 'rating')),
          Customer.aggregate(trendPipeline('%Y-%m', 'isRepeat')),
        ]);
        const monthlyRating: any[] = [];
        ratingData.forEach((d: any) => {
          let e = monthlyRating.find(m => m.period === d._id.period);
          if (!e) { e = { period: d._id.period, High: 0, Medium: 0, Low: 0 }; monthlyRating.push(e); }
          e[d._id.metric] = d.count;
        });
        valueTrend.monthly = monthlyRating;
        const monthlySegment: any[] = [];
        segmentData.forEach((d: any) => {
          let e = monthlySegment.find(m => m.period === d._id.period);
          if (!e) { e = { period: d._id.period, Repeat: 0, Single: 0 }; monthlySegment.push(e); }
          e[d._id.metric ? 'Repeat' : 'Single'] = d.count;
        });
        segmentTrend.monthly = monthlySegment;
      } catch {}
    }

    return { totalCustomers, repeatBuyers, followUpCount, totalOutreachCount, totalOrderCount, segmentTrend, valueTrend, bestSellers, revenueData, leaderboard, agentPerformance, recentActivity, teamActivity };
  });
}
