import { handleApi } from '@/app/lib/api-helper';
import { Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const [start, end] = await Promise.all([
      Setting.findOne({ key: 'outreach_range_start' }),
      Setting.findOne({ key: 'outreach_range_end' }),
    ]);
    return { start: start ? Number(start.value) : 32, end: end ? Number(end.value) : 28 };
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { start, end } = await req.json();
    await Promise.all([
      Setting.findOneAndUpdate({ key: 'outreach_range_start' }, { value: Number(start) }, { upsert: true }),
      Setting.findOneAndUpdate({ key: 'outreach_range_end' },   { value: Number(end) },   { upsert: true }),
    ]);
    return { message: 'Range updated' };
  });
}
