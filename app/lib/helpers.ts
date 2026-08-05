import type { ICustomer } from './models';

// ─── Product name normalisation (Tier 1.3) ───────────────────────────────────
//
// Free-text product names from Steadfast and CSV uploads have casing /
// whitespace drift ("Chocolate 250g" vs "chocolate 250G "). Normalise for
// matching but preserve the original casing for display.

export function normalizeProductName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  // Generic Steadfast fallback isn't a real product — don't mine associations.
  if (trimmed === 'steadfast delivery') return null;
  if (trimmed === 'unknown') return null;
  return trimmed;
}

// ─── Phone normalisation (Tier 3.12) ─────────────────────────────────────────
//
// Bangladesh mobile numbers are 11 digits starting with "01" (e.g. 01712345678).
// The same human enters their number as "01712345678", "+8801712345678",
// "8801712345678", "017-1234-5678", "+88 01712 345678" — without normalisation
// these become 5 different customers and the Steadfast sync uses a slow regex
// scan to match them. The normalised form is always the last 10 digits, which
// uniquely identifies a Bangladesh mobile number regardless of how it was typed.

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return digits; // too short to be a real mobile; keep as-is
  return digits.slice(-10);
}

// ─── Optimal call time per customer (Tier 1.4) ───────────────────────────────
//
// Each follow-up note carries a timestamp and an outcome. "Call Not Received"
// = they didn't pick up; any other feedback = they did. By bucketing each
// customer's call history by hour-of-day (in their local timezone) we learn
// when they actually answer — stopping the team from burning calls at hours
// where THIS customer never picks up.
//
// We use a 4-hour sliding window so the answer is actionable ("call between
// 11 AM and 3 PM") rather than a fragile single-hour point estimate.

// Default timezone is Bangladesh (UTC+6). Override with CRM_TIMEZONE env var
// if the deployment ever expands beyond BD.
const CRM_TIMEZONE = process.env.CRM_TIMEZONE || 'Asia/Dhaka';
const _hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CRM_TIMEZONE,
  hour: 'numeric',
  hour12: false,
});
function _localHour(d: Date): number {
  const parts = _hourFormatter.formatToParts(d);
  const hourPart = parts.find(p => p.type === 'hour');
  // Intl returns "24" for midnight in some locales; normalise to 0-23.
  const h = parseInt(hourPart?.value ?? '0', 10);
  return h === 24 ? 0 : h;
}

export interface CallTimePrediction {
  bestCallHourStart: number | null; // 0-23 — inclusive
  bestCallHourEnd:   number | null; // 0-23 — exclusive (start + 4 hours)
  bestPickupRate:    number;        // 0-1
  bestCallConfidence: 'none' | 'low' | 'medium' | 'high';
  bestCallSummary:   string;        // human-readable, empty if insufficient data
}

function _fmtHour(h: number): string {
  if (h === 0)  return '12AM';
  if (h === 12) return '12PM';
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

export function computeBestCallTime(
  notes: Array<{ date: Date | string; feedback: string }> | null | undefined
): CallTimePrediction {
  const calls = (notes ?? []).filter(n => n?.date && n?.feedback);

  // Need a minimum sample size to say anything useful.
  if (calls.length < 3) {
    return {
      bestCallHourStart: null,
      bestCallHourEnd:   null,
      bestPickupRate:    0,
      bestCallConfidence: 'none',
      bestCallSummary:   '',
    };
  }

  // Bucket calls by local hour, separating answered vs. no-answer.
  const hourStats: Array<{ answered: number; total: number }> = Array.from(
    { length: 24 },
    () => ({ answered: 0, total: 0 })
  );

  for (const n of calls) {
    const d = new Date(n.date);
    if (isNaN(d.getTime())) continue;
    const hr = _localHour(d);
    hourStats[hr].total++;
    if (n.feedback !== 'Call Not Received') hourStats[hr].answered++;
  }

  // Slide a 4-hour window across all 24 hours. Pick the window with the
  // highest pickup rate, tie-breaking by sample size (so we don't end up
  // recommending a 100%-pickup window backed by a single call).
  let bestStart = -1;
  let bestRate  = -1;
  let bestSample = 0;

  for (let start = 0; start < 24; start++) {
    let answered = 0, total = 0;
    for (let i = 0; i < 4; i++) {
      const hr = (start + i) % 24;
      answered += hourStats[hr].answered;
      total    += hourStats[hr].total;
    }
    if (total === 0) continue;
    const rate = answered / total;
    // Require at least 2 calls in the window to consider it; otherwise the
    // signal is noise.
    if (total < 2) continue;
    if (rate > bestRate || (rate === bestRate && total > bestSample)) {
      bestRate   = rate;
      bestStart  = start;
      bestSample = total;
    }
  }

  if (bestStart < 0 || bestRate <= 0) {
    return {
      bestCallHourStart: null,
      bestCallHourEnd:   null,
      bestPickupRate:    0,
      bestCallConfidence: 'none',
      bestCallSummary:   '',
    };
  }

  const bestEnd = (bestStart + 4) % 24;
  const confidence: CallTimePrediction['bestCallConfidence'] =
    calls.length >= 10 ? 'high' : calls.length >= 6 ? 'medium' : 'low';

  return {
    bestCallHourStart: bestStart,
    bestCallHourEnd:   bestEnd,
    bestPickupRate:    bestRate,
    bestCallConfidence: confidence,
    bestCallSummary: `Answers ${_fmtHour(bestStart)}–${_fmtHour(bestEnd)} (${Math.round(bestRate * 100)}% pickup)`,
  };
}

// ─── RFM segmentation (Tier 1.6) ─────────────────────────────────────────────
//
// Replaces the coarse Low/Medium/High valueRating with actionable segments
// based on three dimensions:
//   R — Recency:   how recently did they buy
//   F — Frequency: how often do they buy
//   M — Monetary:  how much do they spend
//
// Each dimension is scored 1-5 (R also has 0 = never purchased). The combined
// score maps to a segment that tells the agent *what to do* about this
// customer, not just how valuable they are.

export type RFMSegment =
  | 'Champion'           // recent + frequent + high spend — protect & upsell
  | 'Loyal'              // frequent (maybe lapsing) — maintain
  | 'Potential Loyalist' // good recency + 1-2 purchases — push to 3rd order
  | 'New'                // just made first purchase
  | 'At Risk'            // historically loyal, gone quiet — win-back
  | "Can't Lose"         // HIGH-VALUE at risk — most urgent
  | 'Hibernating'        // moderate value, gone silent
  | 'Lost'               // 6+ months silent, low value
  | 'Outreach Only';     // never purchased

export interface RFMResult {
  rScore: 0 | 1 | 2 | 3 | 4 | 5;
  fScore: 1 | 2 | 3 | 4 | 5;
  mScore: 1 | 2 | 3 | 4 | 5;
  rfmSegment: RFMSegment;
  rfmAction: string; // one-line recommended next action for agents
}

export function computeRFM(opts: {
  lastPurchaseDate: Date | string | null | undefined;
  purchaseCount: number;
  totalSpending: number;
  now?: Date;
}): RFMResult {
  const now = opts.now ?? new Date();
  const pc  = opts.purchaseCount || 0;
  const ts  = opts.totalSpending || 0;

  const lpd        = opts.lastPurchaseDate ? new Date(opts.lastPurchaseDate) : null;
  const daysSince  = lpd && !isNaN(lpd.getTime())
    ? Math.floor((now.getTime() - lpd.getTime()) / 86_400_000)
    : null;

  // R: 0 = never, 5 = within 30d, 1 = > 180d
  const rScore: RFMResult['rScore'] =
    daysSince === null ? 0 :
    daysSince <= 30   ? 5 :
    daysSince <= 60   ? 4 :
    daysSince <= 90   ? 3 :
    daysSince <= 180  ? 2 : 1;

  // F: 5 = VIP (5+), 4 = loyal (3-4), 3 = repeat (2), 2 = one-time, 1 = none
  const fScore: RFMResult['fScore'] =
    pc >= 5 ? 5 :
    pc >= 3 ? 4 :
    pc === 2 ? 3 :
    pc === 1 ? 2 : 1;

  // M: tuned for BDT — review with the founder if these don't match reality.
  const mScore: RFMResult['mScore'] =
    ts >= 10000 ? 5 :
    ts >= 5000  ? 4 :
    ts >= 2000  ? 3 :
    ts >= 500   ? 2 : 1;

  // Segment classification. Order matters — most specific cases first so
  // "Can't Lose" wins over "At Risk" wins over "Loyal" for the same customer.
  let rfmSegment: RFMSegment;
  let rfmAction: string;

  if (pc === 0) {
    rfmSegment = 'Outreach Only';
    rfmAction  = 'Never purchased — pitch intro offer';
  } else if (pc === 1 && rScore === 5) {
    rfmSegment = 'New';
    rfmAction  = 'Just bought — thank-you call, set reorder expectation';
  } else if (pc === 1 && rScore >= 3) {
    rfmSegment = 'Potential Loyalist';
    rfmAction  = 'Encourage 2nd purchase — bundle or referral incentive';
  } else if (pc === 1 && rScore === 1) {
    rfmSegment = 'Lost';
    rfmAction  = 'Cheap recapture only — low priority';
  } else if (pc === 1) {
    rfmSegment = 'Hibernating';
    rfmAction  = 'Limited-time offer to revive';
  } else if (fScore >= 4 && rScore <= 2 && mScore >= 4) {
    rfmSegment = "Can't Lose";
    rfmAction  = 'URGENT: high-value & lapsing — personal call + discount';
  } else if (fScore >= 3 && rScore <= 2) {
    rfmSegment = 'At Risk';
    rfmAction  = 'Used to be loyal — win-back call with offer';
  } else if (rScore >= 4 && fScore >= 4 && mScore >= 4) {
    rfmSegment = 'Champion';
    rfmAction  = 'Protect — reward, upsell premium, ask for referral';
  } else if (fScore >= 4) {
    rfmSegment = 'Loyal';
    rfmAction  = 'Maintain — regular check-in, new product preview';
  } else if (rScore >= 4) {
    rfmSegment = 'Potential Loyalist';
    rfmAction  = 'Push to 3rd order — bundle or loyalty perk';
  } else if (rScore === 1) {
    rfmSegment = 'Lost';
    rfmAction  = 'Cheap recapture only — low priority';
  } else {
    rfmSegment = 'Hibernating';
    rfmAction  = 'Limited-time offer to revive';
  }

  return { rScore, fScore, mScore, rfmSegment, rfmAction };
}

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

// Most recent real product, skipping the generic Steadfast courier fallback.
// Cached onto the customer doc so read paths (notably Today's Queue) never
// need to project the full `purchases` array.
export function deriveLastProduct(purchases: any[]): string | null {
  if (!purchases?.length) return null;
  const sorted = [...purchases].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  for (const p of sorted) {
    const name = String(p?.product || '').trim();
    const low = name.toLowerCase();
    if (name && low !== 'steadfast delivery' && low !== 'unknown') return name;
  }
  return null;
}

export function recalculateCustomerStats(customer: ICustomer) {
  const purchases = customer.purchases;
  if (!purchases || purchases.length === 0) {
    customer.purchaseCount = 0;
    customer.totalSpending = 0;
    customer.valueRating = 'Low';
    customer.purchaseHistory = '';
    customer.lastProduct = null;
    customer.predictedReorderDays = null;
    customer.nextOutreachDate = null;
    customer.reorderConfidence = 'none';
    // RFM still meaningful for outreach-only customers.
    const rfm = computeRFM({ lastPurchaseDate: null, purchaseCount: 0, totalSpending: 0 });
    customer.rScore     = rfm.rScore;
    customer.fScore     = rfm.fScore;
    customer.mScore     = rfm.mScore;
    customer.rfmSegment = rfm.rfmSegment;
    customer.rfmAction  = rfm.rfmAction;
    // Best call time still computable from prior outreach attempts.
    const callTime = computeBestCallTime(customer.followUpNotes as any);
    customer.bestCallHourStart  = callTime.bestCallHourStart;
    customer.bestCallHourEnd    = callTime.bestCallHourEnd;
    customer.bestPickupRate     = callTime.bestPickupRate;
    customer.bestCallConfidence = callTime.bestCallConfidence;
    customer.bestCallSummary    = callTime.bestCallSummary;
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
  customer.lastProduct = deriveLastProduct(purchases as any);

  // Compute personal reorder cycle from this customer's purchase history.
  const cycle = computeReorderCycle(purchases as any);
  customer.predictedReorderDays = cycle.predictedReorderDays;
  customer.nextOutreachDate     = cycle.nextOutreachDate;
  customer.reorderConfidence    = cycle.reorderConfidence;

  // RFM segmentation (Tier 1.6).
  const rfm = computeRFM({
    lastPurchaseDate: customer.lastPurchaseDate,
    purchaseCount:    customer.purchaseCount,
    totalSpending:    customer.totalSpending,
  });
  customer.rScore     = rfm.rScore;
  customer.fScore     = rfm.fScore;
  customer.mScore     = rfm.mScore;
  customer.rfmSegment = rfm.rfmSegment;
  customer.rfmAction  = rfm.rfmAction;

  // Best call time prediction (Tier 1.4).
  const callTime = computeBestCallTime(customer.followUpNotes as any);
  customer.bestCallHourStart  = callTime.bestCallHourStart;
  customer.bestCallHourEnd    = callTime.bestCallHourEnd;
  customer.bestPickupRate     = callTime.bestPickupRate;
  customer.bestCallConfidence = callTime.bestCallConfidence;
  customer.bestCallSummary    = callTime.bestCallSummary;
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

// ─── Queue scoring ───────────────────────────────────────────────────────────
//
// Lives in ./queueScoring so it can be unit-tested without pulling in mongoose.
// Re-exported here because most call sites already import from this module.

export {
  scoreCustomer,
  globalRecencyFactor,
  DEFAULT_MAX_DORMANCY_DAYS,
} from './queueScoring';
export type {
  ScoringNote,
  ScoringCustomer,
  ScoringOptions,
  ScoringResult,
} from './queueScoring';
