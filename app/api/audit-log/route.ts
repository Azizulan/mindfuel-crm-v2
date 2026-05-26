import { handleApi } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleApi(async () => {
    const url = new URL(req.url);
    const page   = Number(url.searchParams.get('page')   || '1');
    const limit  = Number(url.searchParams.get('limit')  || '20');
    const search = url.searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const pipeline: any[] = [{ $unwind: '$followUpNotes' }];
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { 'followUpNotes.agent': { $regex: search, $options: 'i' } },
            { 'followUpNotes.notes': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }
    const countRes = await Customer.aggregate([...pipeline, { $count: 'total' }]);
    const total = countRes[0]?.total || 0;
    pipeline.push(
      { $sort: { 'followUpNotes.date': -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { customerName: '$name', customerId: '$id', feedback: '$followUpNotes.feedback', notes: '$followUpNotes.notes', agent: '$followUpNotes.agent', date: '$followUpNotes.date', _id: 0 } }
    );
    const data = await Customer.aggregate(pipeline);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  });
}
