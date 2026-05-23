
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
}

export interface ScoringResult {
  score: number;
  reason: string;
  suppressed: boolean;
  suppressionReason?: string;
}

const daysBetween = (a: Date, b: Date): number =>
  Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const isToday = (d: Date, now: Date): boolean =>
  d.getFullYear() === now.getFullYear() &&
  d.getMonth() === now.getMonth() &&
  d.getDate() === now.getDate();

function ltvPoints(totalSpending: number): number {
  if (totalSpending >= 10000) return 100;
  if (totalSpending >= 5000) return 80;
  if (totalSpending >= 3000) return 60;
  if (totalSpending >= 1000) return 40;
  if (totalSpending > 0) return 20;
  return 5;
}

function frequencyPoints(purchaseCount: number): number {
  if (purchaseCount >= 5) return 80;
  if (purchaseCount >= 3) return 60;
  if (purchaseCount === 2) return 40;
  if (purchaseCount === 1) return 20;
  return 5;
}

function recencyUrgencyPoints(daysSinceOrder: number | null): number {
  if (daysSinceOrder === null) return 0;
  if (daysSinceOrder >= 31 && daysSinceOrder <= 60) return 50;
  if (daysSinceOrder >= 61 && daysSinceOrder <= 90) return 40;
  if (daysSinceOrder >= 0 && daysSinceOrder <= 30) return 20;
  if (daysSinceOrder <= 180) return 15;
  return 5;
}

function callRecencyPenalty(daysSinceLastCall: number | null): number {
  if (daysSinceLastCall === null) return 0;
  if (daysSinceLastCall <= 1) return 200;  // suppressed above — belt+suspenders
  if (daysSinceLastCall <= 3) return 150;  // 2-3 days ago: very heavy — can't top uncalled customers
  if (daysSinceLastCall <= 7) return 80;   // 4-7 days ago: significant
  if (daysSinceLastCall <= 14) return 30;  // 8-14 days ago: moderate
  if (daysSinceLastCall <= 30) return 10;  // 15-30 days ago: light
  return 0;
}

function sentimentModifier(
  latestFeedback: string | null,
  reminderDate: Date | null,
  now: Date
): number {
  if (!latestFeedback) return 0;
  if (latestFeedback === 'Call Back Later') {
    if (reminderDate && reminderDate <= now) return 25;
    return 5;
  }
  switch (latestFeedback) {
    case 'Happy': return 15;
    case 'Positive': return 10;
    case 'Neutral': return 0;
    case 'Call Not Received': return -5;
    case 'Not Interested': return -25;
    case 'Angry': return -40;
    default: return 0;
  }
}

function buildReason(params: {
  purchaseCount: number;
  totalSpending: number;
  daysSinceOrder: number | null;
  daysSinceLastCall: number | null;
  latestFeedback: string | null;
  reminderDate: Date | null;
  now: Date;
}): string {
  const { purchaseCount, totalSpending, daysSinceOrder, daysSinceLastCall, latestFeedback, reminderDate, now } = params;

  if (latestFeedback === 'Call Back Later' && reminderDate && reminderDate <= now) {
    return `Overdue callback reminder`;
  }
  if (latestFeedback === 'Happy' || latestFeedback === 'Positive') {
    const orderPart = daysSinceOrder !== null ? `, ${daysSinceOrder}d since last order` : '';
    return `Warm lead (${latestFeedback})${orderPart}`;
  }

  const segmentLabel =
    purchaseCount >= 5 ? 'VIP' :
    purchaseCount >= 3 ? 'Loyal customer' :
    purchaseCount === 2 ? 'Repeat buyer' :
    purchaseCount === 1 ? 'One-time buyer' : 'No orders yet';

  if (daysSinceOrder === null) return `${segmentLabel} — no order history`;
  if (daysSinceOrder >= 31 && daysSinceOrder <= 60) return `${segmentLabel}, ${daysSinceOrder}d since last order — prime reorder window`;
  if (daysSinceOrder > 90) return `${segmentLabel}, dormant ${daysSinceOrder}d`;
  if (daysSinceLastCall !== null && daysSinceLastCall <= 7) return `${segmentLabel}, called ${daysSinceLastCall}d ago`;

  return `${segmentLabel}, ${daysSinceOrder}d since last order`;
}

export function scoreCustomer(customer: ScoringCustomer, agentName: string, now: Date = new Date()): ScoringResult {
  const notes = customer.followUpNotes ?? [];

  // --- Suppression checks ---

  const sortedNotes = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestNote = sortedNotes[0] ?? null;
  const latestFeedback = latestNote?.feedback ?? null;
  const reminderDate = toDate(latestNote?.reminderDate);
  const latestNoteDate = latestNote ? toDate(latestNote.date) : null;
  const daysSinceLatest = latestNoteDate ? daysBetween(latestNoteDate, now) : null;

  // Angry: latest note is Angry
  if (latestFeedback === 'Angry') {
    return { score: 0, reason: '', suppressed: true, suppressionReason: 'Angry' };
  }

  // 2+ Not Interested in last 60 days
  const cutoff60 = new Date(now); cutoff60.setDate(now.getDate() - 60);
  if (notes.filter(n => n.feedback === 'Not Interested' && new Date(n.date) >= cutoff60).length >= 2) {
    return { score: 0, reason: '', suppressed: true, suppressionReason: 'Not Interested ×2 in 60 days' };
  }

  // 3+ Call Not Received in last 14 days
  const cutoff14 = new Date(now); cutoff14.setDate(now.getDate() - 14);
  if (notes.filter(n => n.feedback === 'Call Not Received' && new Date(n.date) >= cutoff14).length >= 3) {
    return { score: 0, reason: '', suppressed: true, suppressionReason: 'Unreachable (3× no answer in 14 days)' };
  }

  // Future "Call Back Later" — suppress until reminder date
  if (latestFeedback === 'Call Back Later' && reminderDate && reminderDate > now) {
    return { score: 0, reason: '', suppressed: true, suppressionReason: `Callback scheduled for ${reminderDate.toLocaleDateString()}` };
  }

  // Called within last 30 days — hard suppress
  // Exception: CBL with a past/due reminder date (exec scheduled a callback — show it)
  const isDueCallback = latestFeedback === 'Call Back Later' && reminderDate && reminderDate <= now;
  if (daysSinceLatest !== null && daysSinceLatest < 30 && !isDueCallback) {
    return { score: 0, reason: '', suppressed: true, suppressionReason: `Called ${daysSinceLatest}d ago` };
  }

  // --- Scoring ---

  const lastOrderDate = toDate(customer.lastPurchaseDate);
  const daysSinceOrder = lastOrderDate ? daysBetween(lastOrderDate, now) : null;

  // Days since last call (any agent)
  const lastCallDate = sortedNotes.length > 0 ? toDate(sortedNotes[0].date) : null;
  const daysSinceLastCall = lastCallDate ? daysBetween(lastCallDate, now) : null;

  // Agent exclusivity penalty: customer was called today by a DIFFERENT agent
  const calledTodayByOther = notes.some(
    n => isToday(new Date(n.date), now) && n.agent !== agentName
  );

  const ltv = ltvPoints(customer.totalSpending);
  const freq = frequencyPoints(customer.purchaseCount);
  const recency = recencyUrgencyPoints(daysSinceOrder);
  const callPenalty = callRecencyPenalty(daysSinceLastCall);
  const sentiment = sentimentModifier(latestFeedback, reminderDate, now);
  const exclusivityPenalty = calledTodayByOther ? 60 : 0;

  const score = ltv + freq + recency - callPenalty + sentiment - exclusivityPenalty;

  const reason = buildReason({
    purchaseCount: customer.purchaseCount,
    totalSpending: customer.totalSpending,
    daysSinceOrder,
    daysSinceLastCall,
    latestFeedback,
    reminderDate,
    now,
  });

  return { score, reason, suppressed: false };
}
