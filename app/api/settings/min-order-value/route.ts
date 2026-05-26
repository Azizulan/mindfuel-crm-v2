import { handleApi } from '@/app/lib/api-helper';
import { Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const doc = await Setting.findOne({ key: 'min_order_value' });
    return { value: doc ? Number(doc.value) : 0 };
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { value } = await req.json();
    await Setting.findOneAndUpdate({ key: 'min_order_value' }, { value: Number(value) }, { upsert: true });
    return { message: 'Value updated' };
  });
}
