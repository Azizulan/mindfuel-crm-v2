import { handleApi, err } from '@/app/lib/api-helper';
import { LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  return handleApi(async () => {
    const { phone } = await params;
    const order = await LocalOrder.findOne({ recipient_phone: phone }).sort({ createdAt: -1 });
    if (!order) return err('No orders found', 404);
    return order;
  });
}
