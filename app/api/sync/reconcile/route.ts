import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { getSteadfastCredentials, steadfastHeaders, PACKZY_BASE } from '@/app/lib/steadfast';

export const dynamic = 'force-dynamic';
// Walks the courier's payment list and every payment's consignments.
export const maxDuration = 300;

// ─── Authoritative sync reconciliation ───────────────────────────────────────
//
// Steadfast is the source of truth. This walks its payments, expands each one
// into consignments, and diffs the resulting consignment IDs against what we
// actually hold in `purchases.steadfastId`.
//
// That makes it possible to say, for any past date, "the courier has N
// deliveries and we are missing M of them" — which no amount of looking at our
// own data can tell you, because a never-synced day and a genuinely quiet day
// look identical from this side.
//
//   POST /api/sync/reconcile  { startDate: '2026-05-01', endDate: '2026-05-31' }

const TZ = process.env.CRM_TIMEZONE || 'Asia/Dhaka';
const MAX_RANGE_DAYS = 120;   // keeps the courier sweep inside maxDuration
const DETAIL_CONCURRENCY = 6; // parallel /payments/{id} fetches

const dayKey = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);

/** Run `worker` over `items` with bounded parallelism. */
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
      }
    })
  );
  return out;
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const { startDate, endDate } = await req.json();
    if (!startDate || !endDate) return err('startDate and endDate are required');

    const rangeStart = new Date(startDate + 'T00:00:00');
    const rangeEnd   = new Date(endDate   + 'T23:59:59');
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime()))
      return err('startDate and endDate must be YYYY-MM-DD');
    if (rangeEnd < rangeStart) return err('endDate must be on or after startDate');

    const spanDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000);
    if (spanDays > MAX_RANGE_DAYS)
      return err(`Range is ${spanDays} days; reconcile at most ${MAX_RANGE_DAYS} at a time.`);

    const creds = await getSteadfastCredentials();
    if (!creds)
      return err('Steadfast API credentials are not configured. Add them in Settings → Courier Integration.');

    const sfHeaders = steadfastHeaders(creds);
    const warnings: string[] = [];

    // ── 1. Walk the payment list (10 per page, oldest first) ──
    const payments: any[] = [];
    let page = 1;
    const MAX_PAGES = 200;
    while (page <= MAX_PAGES) {
      const resp = await fetch(`${PACKZY_BASE}/payments?page=${page}`, { headers: sfHeaders });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Steadfast /payments page ${page} returned ${resp.status}: ${txt.slice(0, 200)}`);
      }
      const raw = await resp.json();
      const items: any[] = raw.payments ?? [];
      if (items.length === 0) break;
      payments.push(...items);
      if (items.length < 10) break;
      page++;
    }
    if (page > MAX_PAGES) warnings.push(`Stopped at the ${MAX_PAGES}-page cap; older payments were not examined.`);

    // A payment can settle well after the delivery, so widen the payment filter
    // and rely on per-consignment dates for the actual bucketing below.
    const padStart = new Date(rangeStart); padStart.setDate(padStart.getDate() - 60);
    const padEnd   = new Date(rangeEnd);   padEnd.setDate(padEnd.getDate() + 60);
    const inWindow = payments.filter(p => {
      const d = p.created_at ? new Date(p.created_at) : null;
      if (!d || isNaN(d.getTime())) return true;
      return d >= padStart && d <= padEnd;
    });

    // ── 2. Expand each payment into consignments ──
    const details = await mapLimit(inWindow, DETAIL_CONCURRENCY, async (p) => {
      const pid = p.payment_id ?? p.id;
      try {
        const r = await fetch(`${PACKZY_BASE}/payments/${pid}`, { headers: sfHeaders });
        if (!r.ok) { warnings.push(`Payment ${pid}: HTTP ${r.status}`); return []; }
        const j = await r.json();
        const cons: any[] = j?.payment?.consignments ?? [];
        return cons.map(c => ({ ...c, _paymentDate: p.created_at }));
      } catch (e: any) {
        warnings.push(`Payment ${pid}: ${e.message}`);
        return [];
      }
    });

    // ── 3. Bucket the courier's consignments by delivery date ──
    interface Bucket { expected: Set<string>; amount: number }
    const expectedByDate = new Map<string, Bucket>();
    const allExpectedIds = new Set<string>();

    for (const c of details.flat()) {
      const raw = c.created_at ?? c._paymentDate;
      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) continue;
      if (d < rangeStart || d > rangeEnd) continue; // bucket by the real delivery date
      const id = String(c.consignment_id ?? c.id ?? '');
      if (!id) continue;
      const key = dayKey(d);
      if (!expectedByDate.has(key)) expectedByDate.set(key, { expected: new Set(), amount: 0 });
      const b = expectedByDate.get(key)!;
      b.expected.add(id);
      b.amount += parseFloat(String(c.cod_amount ?? 0)) || 0;
      allExpectedIds.add(id);
    }

    // ── 4. What do we actually hold for those IDs? ──
    const held = new Set<string>();
    if (allExpectedIds.size > 0) {
      const ids = [...allExpectedIds];
      const CHUNK = 5000;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const rows = await Customer.aggregate([
          { $match: { 'purchases.steadfastId': { $in: slice } } },
          { $unwind: '$purchases' },
          { $match: { 'purchases.steadfastId': { $in: slice } } },
          { $group: { _id: '$purchases.steadfastId' } },
        ]).allowDiskUse(true);
        for (const r of rows) held.add(String(r._id));
      }
    }

    // ── 5. Diff, per date ──
    const days = [...expectedByDate.entries()]
      .map(([date, b]) => {
        const missingIds = [...b.expected].filter(id => !held.has(id));
        return {
          date,
          expected: b.expected.size,
          present: b.expected.size - missingIds.length,
          missing: missingIds.length,
          // Enough to act on without returning thousands of ids.
          missingIds: missingIds.slice(0, 25),
          codAmount: Math.round(b.amount),
          status: missingIds.length === 0
            ? 'complete'
            : missingIds.length === b.expected.size ? 'never-synced' : 'partial',
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalExpected = days.reduce((s, d) => s + d.expected, 0);
    const totalMissing  = days.reduce((s, d) => s + d.missing, 0);

    return {
      startDate, endDate, timezone: TZ,
      days,
      summary: {
        datesWithDeliveries: days.length,
        datesComplete:    days.filter(d => d.status === 'complete').length,
        datesPartial:     days.filter(d => d.status === 'partial').length,
        datesNeverSynced: days.filter(d => d.status === 'never-synced').length,
        totalExpected,
        totalPresent: totalExpected - totalMissing,
        totalMissing,
        paymentsExamined: inWindow.length,
      },
      warnings: warnings.slice(0, 20),
      generatedAt: new Date().toISOString(),
    };
  });
}
