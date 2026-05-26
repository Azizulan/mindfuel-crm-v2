import { handleApi } from '@/app/lib/api-helper';
import { Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const doc = await Setting.findOne({ key: 'gmt_offset' });
    return { value: doc ? Number(doc.value) : 6 };
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { value } = await req.json();
    await Setting.findOneAndUpdate({ key: 'gmt_offset' }, { value: Number(value) }, { upsert: true });
    return { message: 'GMT offset updated' };
  });
}
