import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  return handleApi(async () => {
    const { customerId } = await params;
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) return err('Not found', 404);
    customer.suppressedUntil = null;
    customer.suppressionReason = null;
    await customer.save();
    return { message: 'Suppression lifted', customer };
  });
}
