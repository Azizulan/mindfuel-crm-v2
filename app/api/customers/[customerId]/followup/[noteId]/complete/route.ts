import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ customerId: string; noteId: string }> }
) {
  return handleApi(async () => {
    const { customerId, noteId } = await params;
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) return err('Not found', 404);
    const note = customer.followUpNotes.id(noteId);
    if (note) {
      note.reminderStatus = 'completed';
      await customer.save();
    }
    return customer;
  });
}
