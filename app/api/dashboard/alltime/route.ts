import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const [customers, orders, revenue] = await Promise.all([
      Customer.countDocuments(),
      LocalOrder.countDocuments(),
      LocalOrder.aggregate([{ $group: { _id: null, total: { $sum: '$cod_amount' } } }]),
    ]);
    return { customers, orders, revenue: revenue[0]?.total || 0 };
  });
}
