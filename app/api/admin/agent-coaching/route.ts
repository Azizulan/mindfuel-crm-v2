import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

// Tier 2.8 — Agent coaching signals.
//
// The existing executive-performance endpoint measures VOLUME (calls, orders,
// bonus). This measures QUALITY: of the calls an agent makes, how many reach a
// human, how many turn positive, how many convert to an order, and how much
// revenue each call is worth. That's where coaching lives — two agents with
// identical call counts can have wildly different conversion.
//
//   GET /api/admin/agent-coaching?startDate=&endDate=
export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate   = url.searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);
    const hasDate = Object.keys(dateFilter).length > 0;

    const noteMatch: any = {};
    if (hasDate) noteMatch['followUpNotes.date'] = dateFilter;

    const orderMatch: any = {};
    if (hasDate) orderMatch.createdAt = dateFilter;

    const [noteAgg, orderAgg] = await Promise.all([
      // Per-agent, per-feedback counts.
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        ...(hasDate ? [{ $match: noteMatch }] : []),
        {
          $group: {
            _id: { agent: '$followUpNotes.agent', feedback: '$followUpNotes.feedback' },
            count: { $sum: 1 },
          },
        },
      ]),
      // Per-agent order counts + revenue.
      LocalOrder.aggregate([
        ...(hasDate ? [{ $match: orderMatch }] : []),
        {
          $group: {
            _id: '$agent',
            orders:  { $sum: 1 },
            revenue: { $sum: '$cod_amount' },
          },
        },
      ]),
    ]);

    // Reshape note aggregation into per-agent sentiment buckets.
    interface AgentStat {
      agent: string;
      totalCalls: number;
      happy: number; positive: number; neutral: number;
      callBackLater: number; noAnswer: number; notInterested: number; angry: number;
      contacted: number;       // calls where someone actually answered
      orders: number;
      revenue: number;
    }
    const agents: Record<string, AgentStat> = {};
    const ensure = (name: string): AgentStat => {
      if (!agents[name]) {
        agents[name] = {
          agent: name, totalCalls: 0,
          happy: 0, positive: 0, neutral: 0,
          callBackLater: 0, noAnswer: 0, notInterested: 0, angry: 0,
          contacted: 0, orders: 0, revenue: 0,
        };
      }
      return agents[name];
    };

    for (const row of noteAgg) {
      const agent = row._id.agent;
      if (!agent) continue;
      const fb: string = row._id.feedback;
      const n: number = row.count;
      const a = ensure(agent);
      a.totalCalls += n;
      switch (fb) {
        case 'Happy':             a.happy += n; a.contacted += n; break;
        case 'Positive':          a.positive += n; a.contacted += n; break;
        case 'Neutral':           a.neutral += n; a.contacted += n; break;
        case 'Call Back Later':   a.callBackLater += n; a.contacted += n; break;
        case 'Not Interested':    a.notInterested += n; a.contacted += n; break;
        case 'Angry':             a.angry += n; a.contacted += n; break;
        case 'Call Not Received': a.noAnswer += n; break; // not contacted
        default:                  a.contacted += n; break;
      }
    }
    for (const row of orderAgg) {
      const agent = row._id;
      if (!agent) continue;
      const a = ensure(agent);
      a.orders  = row.orders;
      a.revenue = row.revenue || 0;
    }

    // Derive rates.
    const result = Object.values(agents).map(a => {
      const contactRate    = a.totalCalls > 0 ? a.contacted / a.totalCalls : 0;
      const positiveRate   = a.contacted > 0 ? (a.happy + a.positive) / a.contacted : 0;
      const negativeRate   = a.contacted > 0 ? (a.notInterested + a.angry) / a.contacted : 0;
      const conversionRate = a.contacted > 0 ? a.orders / a.contacted : 0;
      const revenuePerCall = a.totalCalls > 0 ? a.revenue / a.totalCalls : 0;
      return {
        ...a,
        contactRate, positiveRate, negativeRate, conversionRate, revenuePerCall,
        flags: [] as string[],
      };
    });

    // Team averages (only over agents with a meaningful sample, ≥10 calls).
    const sample = result.filter(a => a.totalCalls >= 10);
    const avg = (key: 'conversionRate' | 'positiveRate' | 'negativeRate' | 'revenuePerCall') =>
      sample.length ? sample.reduce((s, a) => s + a[key], 0) / sample.length : 0;
    const teamAverages = {
      conversionRate: avg('conversionRate'),
      positiveRate:   avg('positiveRate'),
      negativeRate:   avg('negativeRate'),
      revenuePerCall: avg('revenuePerCall'),
    };

    // Coaching flags — relative to the team, only for agents with enough data.
    for (const a of result) {
      if (a.totalCalls < 10) { a.flags.push('low-sample'); continue; }
      if (teamAverages.conversionRate > 0 && a.conversionRate >= teamAverages.conversionRate * 1.5)
        a.flags.push('star-closer');
      if (teamAverages.conversionRate > 0 && a.conversionRate <= teamAverages.conversionRate * 0.5)
        a.flags.push('low-conversion');
      if (teamAverages.negativeRate > 0 && a.negativeRate >= teamAverages.negativeRate * 1.5)
        a.flags.push('high-negative');
      if (teamAverages.positiveRate > 0 && a.positiveRate >= teamAverages.positiveRate * 1.3)
        a.flags.push('great-rapport');
      if (a.contactRate < 0.4)
        a.flags.push('low-contact'); // calling at bad times / bad numbers
    }

    result.sort((a, b) => b.conversionRate - a.conversionRate);

    return { agents: result, teamAverages };
  });
}
