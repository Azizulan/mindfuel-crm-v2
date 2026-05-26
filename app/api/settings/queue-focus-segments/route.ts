import { handleApi, err } from '@/app/lib/api-helper';
import { Setting } from '@/app/lib/models';

export const dynamic = 'force-dynamic';

// Stored as a single Setting doc with key 'queue_focus_segments' and
// value = string[] of RFM segment names. Empty array = no filter (default,
// = all eligible customers).
//
// Drives which segments the /api/queue/today endpoint builds the queue from.

export async function GET() {
  return handleApi(async () => {
    const s = await Setting.findOne({ key: 'queue_focus_segments' });
    const value = Array.isArray(s?.value) ? (s!.value as string[]) : [];
    return { value };
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { value } = await req.json();
    if (!Array.isArray(value)) return err('value must be an array of segment names');
    const cleaned = value.filter((v: any) => typeof v === 'string');
    await Setting.updateOne(
      { key: 'queue_focus_segments' },
      { $set: { key: 'queue_focus_segments', value: cleaned } },
      { upsert: true }
    );
    return { value: cleaned };
  });
}
