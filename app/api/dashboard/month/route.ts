import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [outreach, orders, revenue] = await Promise.all([
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: startOfMonth }, 'followUpNotes.feedback': { $ne: 'Call Not Received' } } },
        { $group: { _id: '$id' } }, { $count: 'total' },
      ]),
      LocalOrder.countDocuments({ createdAt: { $gte: startOfMonth } }),
      LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$cod_amount' } } },
      ]),
    ]);
    return { outreach: outreach[0]?.total || 0, orders, revenue: revenue[0]?.total || 0 };
  });
}
