import { handleApi, err } from '@/app/lib/api-helper';
import { LocalOrder } from '@/app/lib/models';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const { id } = await params;
    const order = await LocalOrder.findById(id);
    if (!order) return err('Not found', 404);
    order.status = 'sent_to_courier';
    await order.save();
    return order;
  });
}
