import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { computeBestCallTime } from '@/app/lib/helpers';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  return handleApi(async () => {
    const { customerId } = await params;
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) return err('Not found', 404);
    const newNote = await req.json();
    if (newNote.reminderDate) newNote.reminderStatus = 'pending';
    customer.followUpNotes.push(newNote);

    const now = new Date();
    const feedback = newNote.feedback;

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
