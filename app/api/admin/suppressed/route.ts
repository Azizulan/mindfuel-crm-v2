import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const page  = Number(url.searchParams.get('page')  || '1');
    const limit = Number(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const now = new Date();
    const query = { suppressedUntil: { $gt: now } };
    const [data, total] = await Promise.all([
      Customer.find(query)
        .select('id name phone suppressedUntil suppressionReason totalSpending purchaseCount')
        .sort({ suppressedUntil: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  });
}
