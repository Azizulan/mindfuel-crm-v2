import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { computeBestCallTime } from '@/app/lib/helpers';

// Tier 2.7 — when a call ends positively/neutrally and the agent didn't set a
// manual callback, auto-schedule the next outreach so the warm lead doesn't
// fall through the cracks. Prefers the customer's personal reorder cycle.
function computeAutoReminderDate(customer: any, feedback: string, now: Date): Date {
  // 1. Personal reorder date, if we already computed one and it's in the future.
  if (customer.nextOutreachDate) {
    const d = new Date(customer.nextOutreachDate);
    if (d.getTime() > now.getTime()) return d;
  }
  // 2. Derive from the personal cycle when we trust it.
  if (customer.predictedReorderDays && ['high', 'medium'].includes(customer.reorderConfidence)) {
    const d = new Date(now);
    d.setDate(d.getDate() + Math.round(customer.predictedReorderDays * 0.9));
    return d;
  }
  // 3. Sensible default — tighter nurture for Neutral, longer for a happy buyer.
  const days = feedback === 'Neutral' ? 14 : 30;
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  return handleApi(async () => {
    const { customerId } = await params;
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) return err('Not found', 404);
    const newNote = await req.json();

    const now = new Date();
    const feedback = newNote.feedback;

    // Tier 2.7: auto-schedule the next touch for positive/neutral outcomes
    // when the agent left the callback blank. Negative outcomes are handled
    // by suppression below; "Call Not Received" resurfaces via queue scoring.
    if (!newNote.reminderDate && ['Happy', 'Positive', 'Neutral'].includes(feedback)) {
      newNote.reminderDate = computeAutoReminderDate(customer, feedback, now);
      newNote.autoScheduled = true;
    }

    if (newNote.reminderDate) newNote.reminderStatus = 'pending';
    customer.followUpNotes.push(newNote);

    if (feedback === 'Angry') {
      const until = new Date(now); until.setDate(until.getDate() + 180);
      customer.suppressedUntil = until;
      customer.suppressionReason = 'Angry';
    } else if (feedback === 'Not Interested') {
      const cutoff = new Date(now); cutoff.setDate(now.getDate() - 60);
      const count = customer.followUpNotes.filter(
        (n: any) => n.feedback === 'Not Interested' && new Date(n.date) >= cutoff
      ).length;
      if (count >= 2) {
        const until = new Date(now); until.setDate(until.getDate() + 90);
        customer.suppressedUntil = until;
        customer.suppressionReason = 'Not Interested ×2 in 60 days';
      }
    } else if (feedback === 'Call Not Received') {
      const cutoff = new Date(now); cutoff.setDate(now.getDate() - 14);
      const count = customer.followUpNotes.filter(
        (n: any) => n.feedback === 'Call Not Received' && new Date(n.date) >= cutoff
      ).length;
      if (count >= 3) {
        const until = new Date(now); until.setDate(until.getDate() + 30);
        customer.suppressedUntil = until;
        customer.suppressionReason = 'Unreachable — 3× no answer in 14 days';
      }
    }

    // Recompute optimal call time (Tier 1.4) — cheap, in-memory only.
    const callTime = computeBestCallTime(customer.followUpNotes as any);
    customer.bestCallHourStart  = callTime.bestCallHourStart;
    customer.bestCallHourEnd    = callTime.bestCallHourEnd;
    customer.bestPickupRate     = callTime.bestPickupRate;
    customer.bestCallConfidence = callTime.bestCallConfidence;
    customer.bestCallSummary    = callTime.bestCallSummary;

    await customer.save();
    return customer;
  });
}
