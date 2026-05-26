import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';

export async function POST(req: Request) {
  return handleApi(async () => {
    const { ids, date } = await req.json();
    if (!Array.isArray(ids) || !date) return err('Invalid data');
    const newDate = new Date(date);
    const customers = await Customer.find({ id: { $in: ids } });
    for (const c of customers) {
      c.lastPurchaseDate = newDate;
      if (c.purchases && c.purchases.length > 0) {
        c.purchases.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        c.purchases[0].date = newDate;
      }
      await c.save();
    }
    return { message: `Updated ${customers.length} records.` };
  });
}
