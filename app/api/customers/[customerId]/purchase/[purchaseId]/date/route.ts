import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { recalculateCustomerStats } from '@/app/lib/helpers';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ customerId: string; purchaseId: string }> }
) {
  return handleApi(async () => {
    const { customerId, purchaseId } = await params;
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) return err('Not found', 404);
    const p = customer.purchases.id(purchaseId);
    if (p) {
      const { date } = await req.json();
      p.date = new Date(date);
      recalculateCustomerStats(customer);
      await customer.save();
    }
    return customer;
  });
}
