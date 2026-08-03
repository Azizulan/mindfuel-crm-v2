// ─── Today's Queue scoring ───────────────────────────────────────────────────
//
// Single source of truth for how a customer is ranked in the daily call queue.
// Kept free of any mongoose/runtime imports so it can be unit-tested directly.
//
// The core principle: **lifetime value only counts if the relationship is still
// alive.** Money spent two years ago is not a reason to call someone today.
//
// Previously the score was a flat sum:
//
//     LTV(≤100) + Frequency(≤80) + Recency(≤85) − penalty + sentiment + segment
//
// which had two compounding faults:
//
//   1. LTV + Frequency contributed up to 180 points that never decayed, while
//      recency capped at 85 and bottomed out at 5 — so a customer dormant for
//      181 days and one dormant for 900 days scored identically.
//   2. The "Can't Lose" segment added +60, but that segment is *defined* as
//      lapsed (90+ days silent). The formula was paying a bonus for going quiet,
//      so ghosts outranked warm leads.
//
// Now recency is a **multiplier** on accumulated value, not another addend:
//
//     (LTV + Frequency) × recencyFactor − penalty + sentiment + segment
//
// A ৳12,000 / 6-order customer scores 180 at 45 days and 14 at 550 days.

import type { RFMSegment } from './helpers';

export interface ScoringNote {
  date: Date | string;
  feedback: string;
  agent: string;
  reminderDate?: Date | string | null;
}

export interface ScoringCustomer {
  id: string;
  name: string;
  phone: string;
  totalSpending: number;
  purchaseCount: number;
  lastPurchaseDate?: Date | string | null;
  followUpNotes?: ScoringNote[];
  // Personalised reorder cycle (Tier 1.1).
  predictedReorderDays?: number | null;
  reorderConfidence?: 'none' | 'low' | 'medium' | 'high';
  // RFM segment (Tier 1.6).
  rfmSegment?: RFMSegment;
}

export interface ScoringOptions {
  /** Past this many days with no purchase, drop out of the daily queue and
   *  hand over to the Win-Back lane. */
  maxDormancyDays?: number;
}

export interface ScoringResult {
  score: number;
  reason: string;
  suppressed: boolean;
  suppressionReason?: string;
  reorderStatus?: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null;
  daysVsReorder?: number | null;
  /** The recency multiplier applied to this customer's value, 0..1. Exposed so
   *  callers can decay other value-derived signals (e.g. expected value) by the
   *  same factor instead of letting them float free of dormancy. */
  recencyFactor: number;
}

/** Default dormancy cutoff for the daily queue. A year of silence means the
 *  customer belongs in a win-back campaign, not a routine call list. */
export const DEFAULT_MAX_DORMANCY_DAYS = 365;

const _db = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const _td = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const _isToday = (d: Date, n: Date) =>
  d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();

// ─── Accumulated value (does not decay on its own) ───────────────────────────

const _ltv = (s: number) =>
  s >= 10000 ? 100 : s >= 5000 ? 80 : s >= 3000 ? 60 : s >= 1000 ? 40 : s > 0 ? 20 : 5;

const _freq = (n: number) =>
  n >= 5 ? 80 : n >= 3 ? 60 : n === 2 ? 40 : n === 1 ? 20 : 5;

// ─── Recency decay ───────────────────────────────────────────────────────────

/**
 * Global decay curve, used when we have no trustworthy personal reorder cycle.
 * Peak is 31–120 days: long enough that the customer has consumed what they
 * bought, recent enough that they still remember you.
 */
export function globalRecencyFactor(dso: number | null): number {
  if (dso === null) return 0.15;   // never purchased — outreach only
  if (dso <= 14)  return 0.45;     // just bought; calling now burns the contact
  if (dso <= 30)  return 0.80;
  if (dso <= 120) return 1.00;     // prime reorder window
  if (dso <= 180) return 0.80;
  if (dso <= 270) return 0.40;
  if (dso <= 365) return 0.20;
  return 0.08;                     // effectively dormant
}

/**
 * Personal decay, centred on the customer's own median reorder cycle rather
 * than a fixed window. Only trusted while the customer is plausibly still in
 * cycle (within 2× their normal gap) — beyond that we fall back to the global
 * curve so a long cycle can't excuse indefinite silence.
 */
function personalRecencyFactor(
  dso: number,
  predicted: number,
  confidence: 'medium' | 'high',
): { factor: number; status: 'early' | 'ripe' | 'overdue' | 'churn-risk'; daysVs: number } | null {
  if (dso > predicted * 2) return null; // too far gone to call "in cycle"

  const overdue = dso - predicted;
  // Medium confidence gets a damped curve — we believe the cycle less.
  const damp = confidence === 'high' ? 1.0 : 0.85;

  // Sweet spot: 7d before the predicted reorder through 14d after.
  if (overdue >= -7 && overdue <= 14) return { factor: 1.0 * damp, status: 'ripe', daysVs: overdue };
  if (overdue >= -14 && overdue <= 30)
    return { factor: 0.85 * damp, status: overdue < 0 ? 'early' : 'overdue', daysVs: overdue };
  if (overdue > 30) return { factor: 0.5 * damp, status: 'churn-risk', daysVs: overdue };
  // Well before the cycle — don't burn an attempt yet.
  return { factor: 0.35 * damp, status: 'early', daysVs: overdue };
}

function recencyFactor(
  dso: number | null,
  predicted: number | null | undefined,
  confidence: 'none' | 'low' | 'medium' | 'high' | undefined,
): { factor: number; status: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null; daysVs: number | null } {
  if (dso !== null && predicted && predicted > 0 && (confidence === 'medium' || confidence === 'high')) {
    const personal = personalRecencyFactor(dso, predicted, confidence);
    if (personal) return personal;
  }
  return { factor: globalRecencyFactor(dso), status: null, daysVs: null };
}

// ─── Modifiers ───────────────────────────────────────────────────────────────

const _pen = (d: number | null) =>
  d === null ? 0 : d <= 1 ? 200 : d <= 3 ? 150 : d <= 7 ? 80 : d <= 14 ? 30 : d <= 30 ? 10 : 0;

const _sent = (f: string | null, rd: Date | null, now: Date) => {
  if (!f) return 0;
  if (f === 'Call Back Later') return rd && rd <= now ? 25 : 5;
  return f === 'Happy' ? 15 : f === 'Positive' ? 10 : f === 'Neutral' ? 0
    : f === 'Call Not Received' ? -5 : f === 'Not Interested' ? -25 : f === 'Angry' ? -40 : 0;
};

/**
 * Segment nudge. Rebalanced so that being *active* is what earns a boost.
 *
 * "Can't Lose" and "At Risk" are both defined by having gone quiet, so a large
 * bonus there directly fought the recency decay above. They now get a token
 * nudge only — the dedicated Win-Back queue is the right home for them.
 */
const _segmentBoost = (segment: RFMSegment | undefined): number => {
  switch (segment) {
    case 'Champion':           return 20;  // recent + frequent + high spend
    case 'Potential Loyalist': return 12;
    case 'Loyal':              return 10;
    case "Can't Lose":         return 10;  // was 60 — win-back lane owns these
    case 'New':                return 8;
    case 'At Risk':            return 8;   // was 35
    case 'Hibernating':        return -10;
    case 'Lost':               return -25;
    case 'Outreach Only':      return 0;
    default:                   return 0;
  }
};

// ─── Reason strings ──────────────────────────────────────────────────────────

const _reason = (
  pc: number, dso: number | null, dsc: number | null,
  lf: string | null, rd: Date | null, now: Date,
  reorderStatus: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null,
  daysVs: number | null,
  predictedDays: number | null | undefined,
) => {
  if (lf === 'Call Back Later' && rd && rd <= now) return 'Overdue callback reminder';
  if (lf === 'Happy' || lf === 'Positive') {
    return `Warm lead (${lf})${dso !== null ? `, ${dso}d since last order` : ''}`;
  }
  const seg = pc >= 5 ? 'VIP' : pc >= 3 ? 'Loyal customer' : pc === 2 ? 'Repeat buyer'
    : pc === 1 ? 'One-time buyer' : 'No orders yet';

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
  if (dso > 270) return `${seg}, dormant ${dso}d — value heavily discounted`;
  if (dso > 180) return `${seg}, cooling off — ${dso}d since last order`;
  if (dso >= 31 && dso <= 120) return `${seg}, ${dso}d since last order — prime reorder window`;
  if (dso <= 14) return `${seg}, ordered only ${dso}d ago — low priority`;
  if (dsc !== null && dsc <= 7) return `${seg}, called ${dsc}d ago`;
  return `${seg}, ${dso}d since last order`;
};

// ─── Main entry point ────────────────────────────────────────────────────────

export function scoreCustomer(
  customer: ScoringCustomer,
  agentName: string,
  now: Date = new Date(),
  opts: ScoringOptions = {},
): ScoringResult {
  const maxDormancyDays = opts.maxDormancyDays ?? DEFAULT_MAX_DORMANCY_DAYS;
  const notes = customer.followUpNotes ?? [];
  const sorted = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0] ?? null;
  const lf = latest?.feedback ?? null;
  const rd = _td(latest?.reminderDate);
  const ld = latest ? _td(latest.date) : null;
  const dsl = ld ? _db(ld, now) : null;

  const nil = { score: 0, reason: '', suppressed: true, recencyFactor: 0 };

  // ── Suppression ──
  if (lf === 'Angry') return { ...nil, suppressionReason: 'Angry' };

  const c60 = new Date(now); c60.setDate(now.getDate() - 60);
  if (notes.filter(n => n.feedback === 'Not Interested' && new Date(n.date) >= c60).length >= 2)
    return { ...nil, suppressionReason: 'Not Interested ×2 in 60 days' };

  const c14 = new Date(now); c14.setDate(now.getDate() - 14);
  if (notes.filter(n => n.feedback === 'Call Not Received' && new Date(n.date) >= c14).length >= 3)
    return { ...nil, suppressionReason: 'Unreachable (3× no answer in 14 days)' };

  if (lf === 'Call Back Later' && rd && rd > now)
    return { ...nil, suppressionReason: `Callback scheduled for ${rd.toLocaleDateString()}` };

  const isDue = !!(lf === 'Call Back Later' && rd && rd <= now);
  if (dsl !== null && dsl < 30 && !isDue)
    return { ...nil, suppressionReason: `Called ${dsl}d ago` };

  const lod = _td(customer.lastPurchaseDate);
  const dso = lod ? _db(lod, now) : null;

  // Dormancy cutoff. A customer silent for longer than the cutoff belongs in
  // the Win-Back queue, not the daily list — unless there's a live signal:
  // a due callback, or a positive sentiment from a recent conversation.
  const hasWarmSignal = isDue || lf === 'Happy' || lf === 'Positive';
  if (dso !== null && dso > maxDormancyDays && !hasWarmSignal) {
    return { ...nil, suppressionReason: `Dormant ${dso}d — moved to Win-Back` };
  }

  // ── Scoring ──
  const dsc = dsl; // last call by any agent
  const excl = notes.some(n => _isToday(new Date(n.date), now) && n.agent !== agentName) ? 60 : 0;

  const rec = recencyFactor(dso, customer.predictedReorderDays, customer.reorderConfidence);

  // Accumulated value, discounted by how alive the relationship still is.
  const value = (_ltv(customer.totalSpending) + _freq(customer.purchaseCount)) * rec.factor;

  const score = Math.round(
    value - _pen(dsc) + _sent(lf, rd, now) - excl + _segmentBoost(customer.rfmSegment)
  );

  return {
    score,
    reason: _reason(customer.purchaseCount, dso, dsc, lf, rd, now, rec.status, rec.daysVs, customer.predictedReorderDays),
    suppressed: false,
    reorderStatus: rec.status,
    daysVsReorder: rec.daysVs,
    recencyFactor: rec.factor,
  };
}
