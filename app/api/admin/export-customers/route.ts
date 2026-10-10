import bcrypt from 'bcryptjs';
import { connectDB } from '@/app/lib/db';
import { err } from '@/app/lib/api-helper';
import { Customer, User } from '@/app/lib/models';
import { normalizeProductName } from '@/app/lib/helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Customer export for SMS / WhatsApp campaigns and offline research.
//
//   POST /api/admin/export-customers  { adminEmail, password, list }
//
// Returns a UTF-8 CSV (with BOM so Excel renders Bangla names). Every row gets
// a "Campaign list" label so the full export can be filtered in Excel; passing
// a specific `list` returns only that slice. The whole customer base leaves the
// building with this file, so it re-checks the administrator password exactly
// like clear-database does.

const TZ = process.env.CRM_TIMEZONE || 'Asia/Dhaka';
const MS_PER_DAY = 86_400_000;
const REORDER_HORIZON_DAYS = 7;

const EXPORT_LISTS = {
  all:          'Everyone',
  winback:      'Win-back',
  reorder_due:  'Reorder due',
  second_order: 'Second order push',
  vip:          'VIP / loyal',
  revive:       'Revive (low priority)',
  never:        'Never ordered',
} as const;
type ListKey = keyof typeof EXPORT_LISTS;

const DO_NOT_CONTACT = 'Do not contact';

// One label per customer, most urgent first, so each customer lands in exactly
// one campaign and nobody gets two different messages in the same week.
function campaignList(c: any, now: Date): string {
  if (c.suppressedUntil && new Date(c.suppressedUntil) > now) return DO_NOT_CONTACT;
  if (!c.purchaseCount) return EXPORT_LISTS.never;
  if (c.rfmSegment === "Can't Lose" || c.rfmSegment === 'At Risk') return EXPORT_LISTS.winback;
  if (c.nextOutreachDate && new Date(c.nextOutreachDate).getTime() <= now.getTime() + REORDER_HORIZON_DAYS * MS_PER_DAY)
    return EXPORT_LISTS.reorder_due;
  if (c.rfmSegment === 'Champion' || c.rfmSegment === 'Loyal') return EXPORT_LISTS.vip;
  if (c.rfmSegment === 'New' || c.rfmSegment === 'Potential Loyalist') return EXPORT_LISTS.second_order;
  return EXPORT_LISTS.revive;
}

// Narrow the Mongo scan for a single list; campaignList() makes the final call.
function prefilter(list: ListKey, now: Date): any {
  if (list === 'all') return {};
  const contactable = { $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }] };
  switch (list) {
    case 'winback':      return { ...contactable, rfmSegment: { $in: ['At Risk', "Can't Lose"] } };
    case 'reorder_due':  return { ...contactable, nextOutreachDate: { $lte: new Date(now.getTime() + REORDER_HORIZON_DAYS * MS_PER_DAY) } };
    case 'second_order': return { ...contactable, rfmSegment: { $in: ['New', 'Potential Loyalist'] } };
    case 'vip':          return { ...contactable, rfmSegment: { $in: ['Champion', 'Loyal'] } };
    case 'revive':       return { ...contactable, purchaseCount: { $gt: 0 } };
    case 'never':        return { ...contactable, $and: [{ $or: [{ purchaseCount: 0 }, { purchaseCount: null }] }] };
  }
}

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtDate = (d: any) => (d && !isNaN(new Date(d).getTime()) ? dateFmt.format(new Date(d)) : '');

// 8801XXXXXXXXX — the format SMS gateways and wa.me links expect. It also
// survives Excel, which strips the leading 0 from 01XXXXXXXXX.
function intlPhone(c: any): string {
  const digits = String(c.normalizedPhone || c.phone || '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  return '880' + digits.slice(-10);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Names and addresses come from courier forms — don't let "=HYPERLINK(...)"
  // run as a formula when the file is opened in Excel. "+8801…" stays as is.
  if (typeof v === 'string' && /^([=@\t\r]|[+-](?!\d))/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  'Campaign list', 'Customer ID', 'Name', 'WhatsApp/SMS number', 'Phone (as saved)', 'Email', 'Address',
  'RFM segment', 'Recommended action', 'Orders', 'Total spent (BDT)', 'Avg order (BDT)',
  'First order', 'Last order', 'Days since last order', 'Usual reorder gap (days)', 'Next outreach date',
  'Reorder confidence', 'Last product', 'Products bought', 'Recommended next product', 'Best call time',
  'Last call outcome', 'Last contacted', 'Do not contact until', 'Suppression reason', 'WhatsApp link',
];

export async function POST(req: Request) {
  try {
    await connectDB();
    const { adminEmail, password, list: rawList } = await req.json();
    const admin = await User.findOne({ email: adminEmail, role: 'Administrator', status: 'Active' });
    if (!admin || !(await bcrypt.compare(password || '', admin.password)))
      return err('Invalid administrator password.', 401);

    const list: ListKey = Object.prototype.hasOwnProperty.call(EXPORT_LISTS, rawList) ? rawList : 'all';
    const now = new Date();

    const docs = await Customer.find(prefilter(list, now))
      .select(
        'id name phone normalizedPhone email address purchaseCount totalSpending lastPurchaseDate ' +
        'rfmSegment rfmAction predictedReorderDays nextOutreachDate reorderConfidence lastProduct ' +
        'recommendedProduct bestCallSummary bestCallConfidence suppressedUntil suppressionReason ' +
        'purchases.date purchases.product followUpNotes.date followUpNotes.feedback'
      )
      .lean();

    const rows = docs
      .map((c: any) => ({ c, label: campaignList(c, now) }))
      .filter(({ label }) => list === 'all' || label === EXPORT_LISTS[list]);

    // Biggest spenders first — the people most worth a message.
    rows.sort((a, b) => (b.c.totalSpending || 0) - (a.c.totalSpending || 0));

    const lines = rows.map(({ c, label }) => {
      const purchases = (c.purchases ?? []) as any[];
      const products = new Map<string, string>();
      let firstOrder: Date | null = null;
      for (const p of purchases) {
        const key = normalizeProductName(p.product);
        if (key && !products.has(key)) products.set(key, String(p.product).trim());
        const d = p.date ? new Date(p.date) : null;
        if (d && !isNaN(d.getTime()) && (!firstOrder || d < firstOrder)) firstOrder = d;
      }
      const notes = (c.followUpNotes ?? []) as any[];
      const lastNote = notes.reduce<any>((best, n) => (!best || new Date(n.date) > new Date(best.date) ? n : best), null);
      const daysSince = c.lastPurchaseDate
        ? Math.floor((now.getTime() - new Date(c.lastPurchaseDate).getTime()) / MS_PER_DAY)
        : '';
      const count = c.purchaseCount || 0;
      const spent = c.totalSpending || 0;
      const waNumber = intlPhone(c);
      const suppressed = label === DO_NOT_CONTACT;

      return [
        label, c.id, c.name, waNumber, c.phone, c.email, c.address,
        c.rfmSegment, c.rfmAction, count, Math.round(spent), count ? Math.round(spent / count) : '',
        fmtDate(firstOrder), fmtDate(c.lastPurchaseDate), daysSince, c.predictedReorderDays ?? '', fmtDate(c.nextOutreachDate),
        c.reorderConfidence, c.lastProduct, [...products.values()].join('; '), c.recommendedProduct,
        c.bestCallConfidence === 'high' || c.bestCallConfidence === 'medium' ? c.bestCallSummary : '',
        lastNote?.feedback, fmtDate(lastNote?.date),
        suppressed ? fmtDate(c.suppressedUntil) : '', suppressed ? c.suppressionReason : '',
        waNumber && !suppressed ? `https://wa.me/${waNumber}` : '',
      ].map(csvCell).join(',');
    });

    const csv = '﻿' + [HEADERS.join(','), ...lines].join('\r\n') + '\r\n';
    const filename = `mindfuel-customers-${list.replace('_', '-')}-${fmtDate(now)}.csv`;

    console.log(`[export-customers] ${admin.email} exported ${lines.length} rows (list=${list})`);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
}
