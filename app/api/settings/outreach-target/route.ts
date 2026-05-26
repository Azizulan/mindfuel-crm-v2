import { handleApi } from '@/app/lib/api-helper';
import { Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const doc = await Setting.findOne({ key: 'outreach_target' });
    return { value: doc ? doc.value : 100 };
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { value } = await req.json();
    await Setting.findOneAndUpdate({ key: 'outreach_target' }, { value: Number(value) }, { upsert: true, new: true });
    return { message: 'Target updated' };
  });
}
