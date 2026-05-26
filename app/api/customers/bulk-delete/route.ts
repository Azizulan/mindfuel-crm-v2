import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export async function POST(req: Request) {
  return handleApi(async () => {
    const { ids } = await req.json();
    if (!Array.isArray(ids)) return err('Invalid IDs');
    const result = await Customer.deleteMany({ id: { $in: ids } });
    return { message: `${result.deletedCount} records deleted.` };
  });
}
