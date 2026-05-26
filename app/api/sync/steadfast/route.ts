import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { recalculateCustomerStats } from '@/app/lib/helpers';

export async function POST(req: Request) {
  return handleApi(async () => {
    const { apiKey, secretKey, startDate, endDate } = await req.json();
    if (!apiKey || !secretKey)
      return err('Steadfast API credentials are required. Please add them in Settings → Courier Integration.');

    const PACKZY = 'https://portal.packzy.com/api/v1';
    const sfHeaders: Record<string, string> = {
      'Api-Key': apiKey,
      'Secret-Key': secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const rangeStart = startDate ? new Date(startDate + 'T00:00:00') : null;
    const rangeEnd   = endDate   ? new Date(endDate   + 'T23:59:59') : null;
    const result = { synced: 0, newCustomers: 0, alreadySynced: 0, paymentsProcessed: 0, errors: [] as string[] };

    // Walk all pages (oldest-first, 10/page), then filter by date range
    let page = 1;
    const MAX_PAGES = 200;
    const allPayments: any[] = [];

    while (page <= MAX_PAGES) {
      const resp = await fetch(`${PACKZY}/payments?page=${page}`, { headers: sfHeaders });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Steadfast /payments page ${page} returned ${resp.status}: ${txt.slice(0, 200)}`);
      }
      const raw = await resp.json();
      const items: any[] = raw.payments ?? [];
      if (items.length === 0) break;
      allPayments.push(...items);
      if (items.length < 10) break;
      page++;
    }

    const paymentsInRange = allPayments.filter(p => {
      const d = p.created_at ? new Date(p.created_at) : null;
      if (!d) return true;
      if (rangeStart && d < rangeStart) return false;
      if (rangeEnd   && d > rangeEnd)   return false;
      return true;
    });

    for (const payment of paymentsInRange) {
      try {
        const pid = payment.payment_id;
        const resp2 = await fetch(`${PACKZY}/payments/${pid}`, { headers: sfHeaders });
        if (!resp2.ok) { result.errors.push(`Payment ${pid}: HTTP ${resp2.status}`); continue; }
        const raw2 = await resp2.json();
        const consignments: any[] = raw2?.payment?.consignments ?? [];
        result.paymentsProcessed++;

        for (const c of consignments) {
          const rawPhone = String(c.recipient_phone ?? '').replace(/\D/g, '');
          if (rawPhone.length < 10) continue;
          const last10  = rawPhone.slice(-10);
          const cid     = String(c.consignment_id ?? c.id ?? '');
          const amount  = parseFloat(String(c.cod_amount ?? 0)) || 0;
          const delDate = new Date(c.created_at ?? payment.created_at ?? Date.now());
          const product = c.item_description ?? c.parcel_details ?? c.remarks ?? 'Steadfast Delivery';

          // NOTE: load the full doc (not .lean()) so we can mutate + .save(),
          // which lets recalculateCustomerStats() refresh totals AND the
          // personalised reorder cycle in one place.
          const existing = await Customer.findOne({ phone: { $regex: last10 + '$' } });
          if (existing) {
            const alreadyIn = (existing.purchases ?? []).some((p: any) => p.steadfastId === cid);
            if (alreadyIn) { result.alreadySynced++; continue; }
            existing.purchases.push({ date: delDate, amount, product, steadfastId: cid } as any);
            recalculateCustomerStats(existing);
            await existing.save();
            result.synced++;
          } else {
            const phone11 = rawPhone.length === 11 ? rawPhone : ('0' + rawPhone.slice(-10));
            const fresh = new Customer({
              id: `SF-${phone11}`,
              name: c.recipient_name ?? 'Unknown',
              phone: phone11,
              address: c.recipient_address ?? '',
              purchases: [{ date: delDate, amount, product, steadfastId: cid }],
              followUpNotes: [],
            });
            recalculateCustomerStats(fresh);
            await fresh.save();
            result.newCustomers++;
            result.synced++;
          }
        }
      } catch (e: any) {
        result.errors.push(`Payment ${payment.payment_id ?? payment.id}: ${e.message}`);
      }
    }

    return {
      message: `Sync complete — ${result.synced} deliveries applied (${result.newCustomers} new customer${result.newCustomers !== 1 ? 's' : ''} created). ${result.alreadySynced} already up to date.`,
      ...result,
    };
  });
}
