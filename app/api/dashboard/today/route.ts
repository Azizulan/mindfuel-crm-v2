import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
    const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 86_400_000);
    const oneHourAgo = new Date(now.getTime() - 3_600_000);
    const threeDaysAgo = new Date(startOfToday.getTime() - 3 * 86_400_000);

    const [notesLast7d, todayOrdersAgg, yesterdayOrdersAgg, hotLeadsAgg, remindersAgg] = await Promise.all([
      // All follow-up notes from the last 7 days
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: sevenDaysAgo } } },
        {
          $project: {
            _id: 0,
            agent: '$followUpNotes.agent',
            feedback: '$followUpNotes.feedback',
            date: '$followUpNotes.date',
          },
        },
      ]),
      // Orders revenue today
      LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$cod_amount' } } },
      ]),
      // Orders revenue yesterday
      LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfYesterday, $lt: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$cod_amount' } } },
      ]),
      // Hot leads: latest note is Happy/Positive AND was > 3 days ago
      Customer.aggregate([
        { $match: { followUpNotes: { $exists: true, $not: { $size: 0 } } } },
        {
          $addFields: {
            latestNote: { $arrayElemAt: ['$followUpNotes', -1] },
          },
        },
        {
          $match: {
            'latestNote.feedback': { $in: ['Happy', 'Positive'] },
            'latestNote.date': { $lt: threeDaysAgo },
          },
        },
        { $count: 'total' },
      ]),
      // Reminders overdue or due today
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        {
          $match: {
            'followUpNotes.reminderDate': { $lte: now },
            'followUpNotes.reminderStatus': 'pending',
          },
        },
        { $group: { _id: '$_id' } },
        { $count: 'total' },
      ]),
    ]);

    const todayNotes     = notesLast7d.filter((n: any) => new Date(n.date) >= startOfToday);
    const yesterdayNotes = notesLast7d.filter((n: any) => {
      const d = new Date(n.date);
      return d >= startOfYesterday && d < startOfToday;
    });

    // 7-day sparkline (oldest → newest)
    const callsLast7Days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(sevenDaysAgo.getTime() + i * 86_400_000);
      const dayEnd   = new Date(dayStart.getTime() + 86_400_000);
      return {
        count: notesLast7d.filter((n: any) => {
          const d = new Date(n.date);
          return d >= dayStart && d < dayEnd;
        }).length,
      };
    });

    // Per-agent activity
    const agentMap: Record<string, { calls: number; lastHour: number; happy: number; lastAt: string | null }> = {};
    for (const n of todayNotes) {
      const a = (n.agent as string) || 'Unknown';
      if (!agentMap[a]) agentMap[a] = { calls: 0, lastHour: 0, happy: 0, lastAt: null };
      agentMap[a].calls++;
      if (new Date(n.date) >= oneHourAgo) agentMap[a].lastHour++;
      if (['Happy', 'Positive'].includes(n.feedback)) agentMap[a].happy++;
      const ds = new Date(n.date).toISOString();
      if (!agentMap[a].lastAt || ds > agentMap[a].lastAt!) agentMap[a].lastAt = ds;
    }
    const agentActivity = Object.entries(agentMap)
      .map(([name, s]) => ({
        name,
        callsToday:      s.calls,
        callsLastHour:   s.lastHour,
        happyRateToday:  s.calls > 0 ? Math.round((s.happy / s.calls) * 100) : 0,
        lastActivityAt:  s.lastAt,
      }))
      .sort((a, b) => b.callsToday - a.callsToday);

    // Sentiment breakdown for today
    const sentMap: Record<string, number> = {};
    for (const n of todayNotes) sentMap[n.feedback] = (sentMap[n.feedback] || 0) + 1;
    const sentimentToday = Object.entries(sentMap).map(([sentiment, count]) => ({ sentiment, count }));

    const hotLeadsCount    = hotLeadsAgg[0]?.total    || 0;
    const remindersDueToday = remindersAgg[0]?.total  || 0;

    // Action items / alerts
    const actionItems: { id: string; severity: string; message: string; cta: string; ctaView: string }[] = [];
    if (remindersDueToday > 0) {
      actionItems.push({
        id: 'reminders', severity: 'warning',
        message: `${remindersDueToday} reminder${remindersDueToday > 1 ? 's' : ''} due today`,
        cta: 'View Reminders', ctaView: 'followUp',
      });
    }
    if (hotLeadsCount > 0) {
      actionItems.push({
        id: 'hotLeads', severity: 'info',
        message: `${hotLeadsCount} warm lead${hotLeadsCount > 1 ? 's' : ''} ready to call`,
        cta: 'Open Queue', ctaView: 'callQueue',
      });
    }

    return {
      callsToday:       todayNotes.length,
      callsYesterday:   yesterdayNotes.length,
      callsLast7Days,
      ordersTodayBDT:   todayOrdersAgg[0]?.total     || 0,
      ordersYesterdayBDT: yesterdayOrdersAgg[0]?.total || 0,
      hotLeadsCount,
      remindersDueToday,
      agentActivity,
      sentimentToday,
      actionItems,
    };
  });
}
