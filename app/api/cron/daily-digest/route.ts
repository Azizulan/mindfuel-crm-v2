import { handleApi, err } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Tier 2.11 — Daily founder digest.
//
// Builds a one-glance summary of yesterday's performance + today's priorities
// and emails it to the founder. Designed to be hit by Vercel Cron (see
// vercel.json) but also works on manual GET for testing.
//
// Email is sent via Resend if these env vars are set:
//   RESEND_API_KEY, DIGEST_EMAIL_TO, DIGEST_EMAIL_FROM
// Otherwise the digest is returned as JSON (no-op send) so it's still useful.
//
// Protected by CRON_SECRET if set: requires Authorization: Bearer <CRON_SECRET>.

function bdt(n: number) { return `৳${Math.round(n).toLocaleString()}`; }

export async function GET(req: Request) {
  // Auth: if CRON_SECRET is configured, require it. Vercel Cron sends it.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return err('Unauthorized', 401);
  }

  return handleApi(async () => {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

    const [notesYdayAgg, ordersYday, riskAgg, cantLoseTop, remindersAgg] = await Promise.all([
      // Yesterday's calls by feedback
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: startOfYesterday, $lt: startOfToday } } },
        { $group: { _id: '$followUpNotes.feedback', count: { $sum: 1 } } },
      ]),
      // Yesterday's orders
      LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfYesterday, $lt: startOfToday } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$cod_amount' } } },
      ]),
      // Revenue at risk by segment
      Customer.aggregate([
        { $match: { rfmSegment: { $in: ['At Risk', "Can't Lose"] } } },
        { $group: { _id: '$rfmSegment', count: { $sum: 1 }, value: { $sum: '$totalSpending' } } },
      ]),
      // Top 5 Can't-Lose customers by value
      Customer.find({ rfmSegment: "Can't Lose" })
        .sort({ totalSpending: -1 }).limit(5)
        .select('name phone totalSpending').lean(),
      // Reminders due today or earlier
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.reminderDate': { $lte: now }, 'followUpNotes.reminderStatus': 'pending' } },
        { $group: { _id: '$_id' } },
        { $count: 'total' },
      ]),
    ]);

    // Roll up yesterday's calls.
    let callsYday = 0, contactedYday = 0, positiveYday = 0;
    for (const r of notesYdayAgg) {
      callsYday += r.count;
      if (r._id !== 'Call Not Received') contactedYday += r.count;
      if (r._id === 'Happy' || r._id === 'Positive') positiveYday += r.count;
    }
    const ordersCount = ordersYday[0]?.count || 0;
    const ordersRevenue = ordersYday[0]?.revenue || 0;
    const convRate = contactedYday > 0 ? Math.round((ordersCount / contactedYday) * 100) : 0;
    const positiveRate = contactedYday > 0 ? Math.round((positiveYday / contactedYday) * 100) : 0;

    const riskMap: Record<string, { count: number; value: number }> = {};
    for (const r of riskAgg) riskMap[r._id] = { count: r.count, value: r.value || 0 };
    const recoverableValue = (riskMap['At Risk']?.value || 0) + (riskMap["Can't Lose"]?.value || 0);
    const recoverableCount = (riskMap['At Risk']?.count || 0) + (riskMap["Can't Lose"]?.count || 0);
    const remindersDue = remindersAgg[0]?.total || 0;

    const dateLabel = startOfYesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const digest = {
      date: dateLabel,
      callsYesterday: callsYday,
      contactedYesterday: contactedYday,
      ordersYesterday: ordersCount,
      revenueYesterday: ordersRevenue,
      conversionRate: convRate,
      positiveRate,
      revenueAtRisk: recoverableValue,
      atRiskCount: recoverableCount,
      remindersDueToday: remindersDue,
      topCantLose: (cantLoseTop as any[]).map(c => ({ name: c.name, phone: c.phone, value: c.totalSpending || 0 })),
    };

    // Build HTML email.
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 4px">📊 Daily CRM Digest</h2>
        <p style="color:#888;margin:0 0 20px;font-size:13px">${dateLabel}</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr>
            <td style="padding:12px;background:#f8fafc;border-radius:8px">
              <div style="font-size:24px;font-weight:800">${callsYday}</div>
              <div style="font-size:11px;color:#888;text-transform:uppercase">Calls</div>
            </td>
            <td style="width:8px"></td>
            <td style="padding:12px;background:#f0fdf4;border-radius:8px">
              <div style="font-size:24px;font-weight:800;color:#16a34a">${ordersCount}</div>
              <div style="font-size:11px;color:#888;text-transform:uppercase">Orders · ${bdt(ordersRevenue)}</div>
            </td>
            <td style="width:8px"></td>
            <td style="padding:12px;background:#eef2ff;border-radius:8px">
              <div style="font-size:24px;font-weight:800;color:#4f46e5">${convRate}%</div>
              <div style="font-size:11px;color:#888;text-transform:uppercase">Conversion</div>
            </td>
          </tr>
        </table>

        <div style="padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#b45309">⚠ ${bdt(recoverableValue)} revenue at risk</div>
          <div style="font-size:12px;color:#92400e;margin-top:2px">${recoverableCount} At-Risk / Can't-Lose customers — still saveable with a call.</div>
        </div>

        ${remindersDue > 0 ? `<p style="font-size:13px">📅 <b>${remindersDue}</b> reminder${remindersDue > 1 ? 's' : ''} due today.</p>` : ''}

        ${digest.topCantLose.length > 0 ? `
          <h3 style="font-size:13px;margin:20px 0 8px">🔴 Top Can't-Lose customers to call today</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${digest.topCantLose.map(c => `
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:8px 0">${c.name}</td>
                <td style="padding:8px 0;color:#888;font-family:monospace">${c.phone}</td>
                <td style="padding:8px 0;text-align:right;font-weight:700">${bdt(c.value)}</td>
              </tr>`).join('')}
          </table>` : ''}

        <p style="color:#bbb;font-size:11px;margin-top:24px">Positive rate yesterday: ${positiveRate}% · Contacted: ${contactedYday}/${callsYday}</p>
      </div>`;

    // Send via Resend if configured; otherwise return the digest for testing.
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.DIGEST_EMAIL_TO;
    const from = process.env.DIGEST_EMAIL_FROM;
    let sent = false;
    let sendError: string | null = null;

    if (apiKey && to && from) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: to.split(',').map(s => s.trim()),
            subject: `📊 Daily CRM Digest — ${dateLabel}`,
            html,
          }),
        });
        if (resp.ok) sent = true;
        else sendError = `Resend HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      } catch (e: any) {
        sendError = e.message;
      }
    } else {
      sendError = 'Email not configured (set RESEND_API_KEY, DIGEST_EMAIL_TO, DIGEST_EMAIL_FROM). Returning digest only.';
    }

    return { sent, sendError, digest };
  });
}
