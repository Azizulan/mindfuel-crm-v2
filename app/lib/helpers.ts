import type { ICustomer } from './models';

// ─── Per-customer reorder cycle prediction (Tier 1.1) ────────────────────────
//
// Returns the median gap between this customer's purchases plus a confidence
// rating based on sample size. Used to time outreach to this customer's
// personal buying rhythm instead of a one-size-fits-all global window.

export interface ReorderCycle {
  predictedReorderDays: number | null;
  nextOutreachDate: Date | null;
  reorderConfidence: 'none' | 'low' | 'medium' | 'high';
}

export function computeReorderCycle(
  purchases: Array<{ date: Date | string; amount?: number }> | null | undefined
): ReorderCycle {
  const list = (purchases ?? []).filter(p => p?.date);

  if (list.length === 0) {
    return { predictedReorderDays: null, nextOutreachDate: null, reorderConfidence: 'none' };
  }
  if (list.length === 1) {
    // Single purchase: not enough to predict — leave for the global heuristic.
    return { predictedReorderDays: null, nextOutreachDate: null, reorderConfidence: 'low' };
  }

  // Sort purchase timestamps ascending and compute adjacent gaps in days.
  const sortedMs = list
    .map(p => new Date(p.date).getTime())
    .filter(ms => !isNaN(ms))
    .sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < sortedMs.length; i++) {
    const gap = (sortedMs[i] - sortedMs[i - 1]) / 86_400_000;
    // Ignore same-day duplicates (likely the same Steadfast consignment re-imported)
    // and outliers > 1 year (probably a one-off or a returning lapsed customer).
    if (gap >= 1 && gap <= 365) gaps.push(gap);
  }

  if (gaps.length === 0) {
    return { predictedReorderDays: null, nextOutreachDate: null, reorderConfidence: 'low' };
  }

  // Median is robust to one-off long-gap outliers (vacation, illness, etc.)
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sortedGaps.length / 2);
  const median =
    sortedGaps.length % 2 === 0
      ? (sortedGaps[mid - 1] + sortedGaps[mid]) / 2
      : sortedGaps[mid];
  const predictedReorderDays = Math.round(median);

  // Confidence reflects how much data we have:
  //   4+ gaps (5+ purchases) → high
  //   2-3 gaps               → medium
  //   1 gap                  → low
  const reorderConfidence: ReorderCycle['reorderConfidence'] =
    gaps.length >= 4 ? 'high' : gaps.length >= 2 ? 'medium' : 'low';

  // Target the call slightly before the predicted reorder so we land in
  // the customer's "thinking about it" window rather than after they've
  // already reordered elsewhere.
  const lastMs = sortedMs[sortedMs.length - 1];
  const nextOutreachDate = new Date(lastMs + predictedReorderDays * 0.9 * 86_400_000);

  return { predictedReorderDays, nextOutreachDate, reorderConfidence };
}

// ─── Customer stats recalculation ────────────────────────────────────────────

export function recalculateCustomerStats(customer: ICustomer) {
  const purchases = customer.purchases;
  if (!purchases || purchases.length === 0) {
    customer.purchaseCount = 0;
    customer.totalSpending = 0;
    customer.valueRating = 'Low';
    customer.purchaseHistory = '';
    customer.predictedReorderDays = null;
    customer.nextOutreachDate = null;
    customer.reorderConfidence = 'none';
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

  // Compute personal reorder cycle from this customer's purchase history.
  const cycle = computeReorderCycle(purchases as any);
  customer.predictedReorderDays = cycle.predictedReorderDays;
  customer.nextOutreachDate     = cycle.nextOutreachDate;
  customer.reorderConfidence    = cycle.reorderConfidence;
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
  // Optional personalised reorder fields (Tier 1.1).
  predictedReorderDays?: number | null;
  reorderConfidence?: 'none' | 'low' | 'medium' | 'high';
}
interface ScoringResult {
  score: number;
  reason: string;
  suppressed: boolean;
  suppressionReason?: string;
  // Surfaced so the queue card can show "Ripe now" / "3d overdue" etc.
  reorderStatus?: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null;
  daysVsReorder?: number | null;
}

const _db = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const _td = (v: any): Date | null => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const _isToday = (d: Date, n: Date) =>
  d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();

const _ltv = (s: number) => s >= 10000 ? 100 : s >= 5000 ? 80 : s >= 3000 ? 60 : s >= 1000 ? 40 : s > 0 ? 20 : 5;
const _freq = (n: number) => n >= 5 ? 80 : n >= 3 ? 60 : n === 2 ? 40 : n === 1 ? 20 : 5;

// Global recency heuristic — used for new customers without a confident cycle.
const _recGlobal = (d: number | null) =>
  d === null ? 0 : d >= 31 && d <= 60 ? 50 : d >= 61 && d <= 90 ? 40 : d >= 0 && d <= 30 ? 20 : d <= 180 ? 15 : 5;

// Personalised recency — boosts customers nearing/in/past their own median
// reorder cycle. Falls back to the global heuristic when we don't have enough
// purchases to be confident in the prediction.
const _recPersonal = (
  dso: number | null,
  predictedDays: number | null | undefined,
  confidence: 'none' | 'low' | 'medium' | 'high' | undefined,
): { score: number; status: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null; daysVs: number | null } => {
  if (dso === null) return { score: 0, status: null, daysVs: null };
  if (!predictedDays || !confidence || confidence === 'none' || confidence === 'low') {
    return { score: _recGlobal(dso), status: null, daysVs: null };
  }
  const overdue = dso - predictedDays;
  const weight  = confidence === 'high' ? 1.0 : 0.7;

  // Sweet spot: 7d before predicted reorder → 14d after. Highest expected
  // conversion: they're thinking about reordering right now.
  if (overdue >= -7 && overdue <= 14)
    return { score: Math.round(85 * weight), status: 'ripe', daysVs: overdue };

  // Acceptable window: still in the conversion zone, just a bit early/late.
  if (overdue >= -14 && overdue <= 30)
    return { score: Math.round(55 * weight), status: overdue < 0 ? 'early' : 'overdue', daysVs: overdue };

  // Past due: less likely to convert but worth a save attempt.
  if (overdue > 30 && overdue <= 60)
    return { score: Math.round(30 * weight), status: 'overdue', daysVs: overdue };

  // Churn risk: way past their normal cycle — surface them for a win-back.
  if (overdue > 60)
    return { score: Math.round(20 * weight), status: 'churn-risk', daysVs: overdue };

  // Far too early: don't burn an attempt yet.
  return { score: Math.round(8 * weight), status: 'early', daysVs: overdue };
};

const _pen = (d: number | null) =>
  d === null ? 0 : d <= 1 ? 200 : d <= 3 ? 150 : d <= 7 ? 80 : d <= 14 ? 30 : d <= 30 ? 10 : 0;
const _sent = (f: string | null, rd: Date | null, now: Date) => {
  if (!f) return 0;
  if (f === 'Call Back Later') return rd && rd <= now ? 25 : 5;
  return f === 'Happy' ? 15 : f === 'Positive' ? 10 : f === 'Neutral' ? 0
    : f === 'Call Not Received' ? -5 : f === 'Not Interested' ? -25 : f === 'Angry' ? -40 : 0;
};
const _reason = (
  pc: number, dso: number | null, dsc: number | null,
  lf: string | null, rd: Date | null, now: Date,
  reorderStatus: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null,
  daysVs: number | null,
  predictedDays: number | null | undefined,
) => {
  if (lf === 'Call Back Later' && rd && rd <= now) return 'Overdue callback reminder';
  if (lf === 'Happy' || lf === 'Positive') return `Warm lead (${lf})${dso !== null ? `, ${dso}d since last order` : ''}`;
  const seg = pc >= 5 ? 'VIP' : pc >= 3 ? 'Loyal customer' : pc === 2 ? 'Repeat buyer' : pc === 1 ? 'One-time buyer' : 'No orders yet';

  // Prefer the personal-cycle reason when we have one — it's more actionable.
  if (reorderStatus === 'ripe' && predictedDays)
    return `${seg} — in personal reorder window (~${predictedDays}d cycle)`;
  if (reorderStatus === 'overdue' && daysVs !== null)
    return `${seg}, ${daysVs}d past their usual ${predictedDays}d cycle`;
  if (reorderStatus === 'churn-risk' && daysVs !== null)
    return `${seg}, ${daysVs}d past cycle — churn risk, try win-back`;
  if (reorderStatus === 'early' && daysVs !== null && predictedDays)
    return `${seg}, ${Math.abs(daysVs)}d early (cycle ~${predictedDays}d)`;

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

  // Personal reorder cycle replaces the global recency score when we have
  // enough purchase history to trust it.
  const rec = _recPersonal(dso, customer.predictedReorderDays, customer.reorderConfidence);

  const score = _ltv(customer.totalSpending) + _freq(customer.purchaseCount)
              + rec.score - _pen(dsc) + _sent(lf, rd, now) - excl;

  return {
    score,
    reason: _reason(customer.purchaseCount, dso, dsc, lf, rd, now, rec.status, rec.daysVs, customer.predictedReorderDays),
    suppressed: false,
    reorderStatus: rec.status,
    daysVsReorder: rec.daysVs,
  };
}
