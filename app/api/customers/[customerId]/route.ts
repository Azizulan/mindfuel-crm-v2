import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { recalculateCustomerStats } from '@/app/lib/helpers';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  return handleApi(async () => {
    const { customerId } = await params;
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) return err('Customer not found', 404);
    const updates = await req.json();
    if (updates.name) customer.name = updates.name;
    if (updates.phone) customer.phone = updates.phone;
    if (updates.email) customer.email = updates.email;
    if (updates.address) customer.address = updates.address;
    if (updates.purchases) {
      customer.purchases = updates.purchases.map((p: any) => ({ ...p, date: new Date(p.date) })) as any;
    }
    recalculateCustomerStats(customer);
    await customer.save();
    return customer;
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  return handleApi(async () => {
    const { customerId } = await params;
    const result = await Customer.deleteOne({ id: customerId });
    if (result.deletedCount === 0) return err('Customer not found', 404);
    return { message: 'Customer deleted successfully' };
  });
}
