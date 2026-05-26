import { handleApi } from '@/app/lib/api-helper';
import { Customer, LocalOrder } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const [outreach, orders, revenue] = await Promise.all([
      Customer.aggregate([
        { $unwind: '$followUpNotes' },
        { $match: { 'followUpNotes.date': { $gte: startOfDay, $lte: endOfDay }, 'followUpNotes.feedback': { $ne: 'Call Not Received' } } },
        { $group: { _id: '$id' } }, { $count: 'total' },
      ]),
      LocalOrder.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: '$cod_amount' } } },
      ]),
    ]);
    return { outreach: outreach[0]?.total || 0, orders, revenue: revenue[0]?.total || 0 };
  });
}
