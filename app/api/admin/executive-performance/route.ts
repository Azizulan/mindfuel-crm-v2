import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate') || '';
    const endDate   = url.searchParams.get('endDate')   || '';

    const outreachFilter: any = {};
    if (startDate) outreachFilter.$gte = new Date(startDate);
    if (endDate)   outreachFilter.$lte = new Date(endDate);
    const outreachMatch: any = { 'followUpNotes.feedback': { $ne: 'Call Not Received' } };
    if (Object.keys(outreachFilter).length) outreachMatch['followUpNotes.date'] = outreachFilter;

    const salesFilter: any = {};
    if (startDate) salesFilter.$gte = new Date(startDate);
    if (endDate)   salesFilter.$lte = new Date(endDate);
    const salesMatch: any = {};
    if (Object.keys(salesFilter).length) salesMatch.createdAt = salesFilter;

    const [outreachAgg, salesPipelineBase] = await Promise.all([
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: outreachMatch },
        { $group: { _id: { agent: '$followUpNotes.agent', month: { $dateToString: { format: '%Y-%m', date: '$followUpNotes.date' } } }, outreachCount: { $sum: 1 } } },
      ]),
      Promise.resolve([] as any[]),
    ]);

    const salesPipeline: any[] = [];
    if (Object.keys(salesMatch).length) salesPipeline.push({ $match: salesMatch });
    salesPipeline.push({
      $group: {
        _id: { agent: '$agent', month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } },
        totalOrders: { $sum: 1 },
        approvedOrders: { $sum: { $cond: [{ $eq: ['$status', 'sent_to_courier'] }, 1, 0] } },
      },
    });
    const salesAgg = await LocalOrder.aggregate(salesPipeline);

    const map: Record<string, Record<string, any>> = {};
    outreachAgg.forEach((item: any) => {
      const { agent, month } = item._id;
      if (!agent) return;
      if (!map[agent]) map[agent] = {};
      if (!map[agent][month]) map[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 };
      map[agent][month].outreachCount = item.outreachCount;
    });
    salesAgg.forEach((item: any) => {
      const { agent, month } = item._id;
      if (!agent) return;
      if (!map[agent]) map[agent] = {};
      if (!map[agent][month]) map[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 };
      map[agent][month].orderCount = item.totalOrders;
      map[agent][month].earnings = item.totalOrders * 7;
    });

    return Object.keys(map)
      .map(name => {
        const history = Object.values(map[name]).sort((a, b) => b.month.localeCompare(a.month));
        const totalOrders = history.reduce((s: number, r: any) => s + (r.orderCount || 0), 0);
        return { agentName: name, history, totalOrders };
      })
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .map(({ agentName, history }) => ({ agentName, history }));
  });
}
