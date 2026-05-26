import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const page = Number(url.searchParams.get('page') || '1');
    const limit = Number(url.searchParams.get('limit') || '10');
    const sortField = url.searchParams.get('sortField') || 'lastPurchaseDate';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const orderNum = sortOrder === 'asc' ? 1 : -1;

    if (sortField === 'health' || sortField === 'lastInteractionDate') {
      const pipeline: any[] = [{ $match: query }];
      if (sortField === 'health') {
        pipeline.push({
          $addFields: {
            issueCount: {
              $add: [
                { $cond: [{ $or: [{ $eq: ['$name', 'Unknown'] }, { $not: ['$name'] }] }, 1, 0] },
                { $cond: [{ $not: ['$lastPurchaseDate'] }, 1, 0] },
                { $cond: [{ $lt: [{ $size: { $ifNull: ['$purchases', []] } }, 1] }, 1, 0] },
                { $cond: [{ $lt: [{ $strLenCP: { $ifNull: ['$phone', ''] } }, 10] }, 1, 0] },
                { $cond: [{ $eq: ['$lastPurchaseDate', new Date(0)] }, 1, 0] },
              ],
            },
          },
        });
        pipeline.push({ $sort: { issueCount: orderNum as 1 | -1, name: 1 } });
      } else {
        pipeline.push({
          $addFields: {
            sortInteractionDate: { $ifNull: [{ $max: '$followUpNotes.date' }, new Date(0)] },
          },
        });
        pipeline.push({ $sort: { sortInteractionDate: orderNum as 1 | -1 } });
      }
      pipeline.push({ $skip: skip }, { $limit: limit });
      const [data, total] = await Promise.all([
        Customer.aggregate(pipeline),
        Customer.countDocuments(query),
      ]);
      return { data, total, page, totalPages: Math.ceil(total / limit) };
    }

    const sort: any = { [sortField]: orderNum };
    const [customers, total] = await Promise.all([
      Customer.find(query).sort(sort).skip(skip).limit(limit),
      Customer.countDocuments(query),
    ]);
    return { data: customers, total, page, totalPages: Math.ceil(total / limit) };
  });
}
