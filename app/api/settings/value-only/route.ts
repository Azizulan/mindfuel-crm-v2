import { handleApi } from '@/app/lib/api-helper';
import { Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const doc = await Setting.findOne({ key: 'value_only_mode' });
    return { value: doc ? !!doc.value : false };
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { value } = await req.json();
    await Setting.findOneAndUpdate({ key: 'value_only_mode' }, { value: !!value }, { upsert: true });
    return { message: 'Mode updated' };
  });
}
