import type { ICustomer } from './models';

// ─── Customer stats recalculation ────────────────────────────────────────────

export function recalculateCustomerStats(customer: ICustomer) {
  const purchases = customer.purchases;
  if (!purchases || purchases.length === 0) {
    customer.purchaseCount = 0;
    customer.totalSpending = 0;
    customer.valueRating = 'Low';
    customer.purchaseHistory = '';
    return;
  }
  const sorted = [...purchases].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  customer.lastPurchaseDate = sorted[0].date;
  customer.purchaseCount = purchases.length;
  customer.totalSpending = purchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  customer.valueRating =
    customer.totalSpending >= 3000 ? 'High' : customer.totalSpending >= 1000 ? 'Medium' : 'Low';
  customer.purchaseHistory = [...new Set(purchases.map((p: any) => p.product))].join(', ');
}

// ─── Map Mongoose doc to plain object with id string ─────────────────────────

export function mapToId(doc: any) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj._id) obj.id = obj._id.toString();
  return obj;
}

export function formatUserResponse(userDoc: any) {
  const u = mapToId(userDoc);
  delete u.password;
  return u;
}

// ─── Queue scoring (same logic as src/lib/queueScoring.ts) ───────────────────

interface ScoringNote {
  date: Date | string;
  feedback: string;
  agent: string;
  reminderDate?: Date | string | null;
}
interface ScoringCustomer {
  id: string;
  name: string;
  phone: string;
  totalSpending: number;
  purchaseCount: number;
  lastPurchaseDate?: Date | string | null;
  followUpNotes?: ScoringNote[];
}
interface ScoringResult {
  score: number;
  reason: string;
  suppressed: boolean;
  suppressionReason?: string;
}

const _db = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const _td = (v: any): Date | null => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const _isToday = (d: Date, n: Date) =>
  d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();

const _ltv = (s: number) => s >= 10000 ? 100 : s >= 5000 ? 80 : s >= 3000 ? 60 : s >= 1000 ? 40 : s > 0 ? 20 : 5;
const _freq = (n: number) => n >= 5 ? 80 : n >= 3 ? 60 : n === 2 ? 40 : n === 1 ? 20 : 5;
const _rec = (d: number | null) =>
  d === null ? 0 : d >= 31 && d <= 60 ? 50 : d >= 61 && d <= 90 ? 40 : d >= 0 && d <= 30 ? 20 : d <= 180 ? 15 : 5;
const _pen = (d: number | null) =>
  d === null ? 0 : d <= 1 ? 200 : d <= 3 ? 150 : d <= 7 ? 80 : d <= 14 ? 30 : d <= 30 ? 10 : 0;
const _sent = (f: string | null, rd: Date | null, now: Date) => {
  if (!f) return 0;
  if (f === 'Call Back Later') return rd && rd <= now ? 25 : 5;
  return f === 'Happy' ? 15 : f === 'Positive' ? 10 : f === 'Neutral' ? 0
    : f === 'Call Not Received' ? -5 : f === 'Not Interested' ? -25 : f === 'Angry' ? -40 : 0;
};
const _reason = (pc: number, dso: number | null, dsc: number | null, lf: string | null, rd: Date | null, now: Date) => {
  if (lf === 'Call Back Later' && rd && rd <= now) return 'Overdue callback reminder';
  if (lf === 'Happy' || lf === 'Positive') return `Warm lead (${lf})${dso !== null ? `, ${dso}d since last order` : ''}`;
  const seg = pc >= 5 ? 'VIP' : pc >= 3 ? 'Loyal customer' : pc === 2 ? 'Repeat buyer' : pc === 1 ? 'One-time buyer' : 'No orders yet';
  if (dso === null) return `${seg} — no order history`;
  if (dso >= 31 && dso <= 60) return `${seg}, ${dso}d since last order — prime reorder window`;
  if (dso > 90) return `${seg}, dormant ${dso}d`;
  if (dsc !== null && dsc <= 7) return `${seg}, called ${dsc}d ago`;
  return `${seg}, ${dso}d since last order`;
};

export function scoreCustomer(customer: ScoringCustomer, agentName: string, now: Date = new Date()): ScoringResult {
  const notes = customer.followUpNotes ?? [];
  const sorted = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0] ?? null;
  const lf = latest?.feedback ?? null;
  const rd = _td(latest?.reminderDate);
  const ld = latest ? _td(latest.date) : null;
  const dsl = ld ? _db(ld, now) : null;

  if (lf === 'Angry') return { score: 0, reason: '', suppressed: true, suppressionReason: 'Angry' };
  const c60 = new Date(now); c60.setDate(now.getDate() - 60);
  if (notes.filter(n => n.feedback === 'Not Interested' && new Date(n.date) >= c60).length >= 2)
    return { score: 0, reason: '', suppressed: true, suppressionReason: 'Not Interested ×2 in 60 days' };
  const c14 = new Date(now); c14.setDate(now.getDate() - 14);
  if (notes.filter(n => n.feedback === 'Call Not Received' && new Date(n.date) >= c14).length >= 3)
    return { score: 0, reason: '', suppressed: true, suppressionReason: 'Unreachable (3× no answer in 14 days)' };
  if (lf === 'Call Back Later' && rd && rd > now)
    return { score: 0, reason: '', suppressed: true, suppressionReason: `Callback scheduled for ${rd.toLocaleDateString()}` };
  const isDue = lf === 'Call Back Later' && rd && rd <= now;
  if (dsl !== null && dsl < 30 && !isDue)
    return { score: 0, reason: '', suppressed: true, suppressionReason: `Called ${dsl}d ago` };

  const lod = _td(customer.lastPurchaseDate);
  const dso = lod ? _db(lod, now) : null;
  const lcd = sorted.length > 0 ? _td(sorted[0].date) : null;
  const dsc = lcd ? _db(lcd, now) : null;
  const excl = notes.some(n => _isToday(new Date(n.date), now) && n.agent !== agentName) ? 60 : 0;
  const score = _ltv(customer.totalSpending) + _freq(customer.purchaseCount) + _rec(dso) - _pen(dsc) + _sent(lf, rd, now) - excl;
  return { score, reason: _reason(customer.purchaseCount, dso, dsc, lf, rd, now), suppressed: false };
}
