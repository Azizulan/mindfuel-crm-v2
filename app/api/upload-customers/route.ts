import { NextResponse } from 'next/server';
import { handleApi, err } from '@/app/lib/api-helper';
import { Customer } from '@/app/lib/models';
import { computeReorderCycle } from '@/app/lib/helpers';

export async function POST(req: Request) {
  return handleApi(async () => {
    const customersData = await req.json();
    if (!Array.isArray(customersData) || customersData.length === 0)
      return err('No valid records to process.');

    const operations = customersData.map((cust: any) => {
      const purchases = (cust.purchases || []).map((p: any) => ({ ...p, date: new Date(p.date) }));
      let lastPurchaseDate = new Date(cust.lastPurchaseDate);
      if (isNaN(lastPurchaseDate.getTime())) lastPurchaseDate = new Date();
      const totalSpending = purchases.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const valueRating = totalSpending >= 3000 ? 'High' : totalSpending >= 1000 ? 'Medium' : 'Low';

      // Personalised reorder cycle — same logic as recalculateCustomerStats()
      // but computed inline so we can keep the bulkWrite fast-path.
      const cycle = computeReorderCycle(purchases);

      return {
        updateOne: {
          filter: { phone: String(cust.phone).trim() },
          update: {
            $set: {
              id: String(cust.phone).trim(),
              name: String(cust.name || 'Unknown').trim(),
              email: String(cust.email || '').trim(),
              address: String(cust.address || '').trim(),
              purchases,
              lastPurchaseDate,
              totalSpending,
              valueRating,
              purchaseCount: purchases.length,
              predictedReorderDays: cycle.predictedReorderDays,
              nextOutreachDate:     cycle.nextOutreachDate,
              reorderConfidence:    cycle.reorderConfidence,
            },
          },
          upsert: true,
        },
      };
    });
    await Customer.bulkWrite(operations);
    return NextResponse.json({ message: `${operations.length} records synchronized.` }, { status: 201 });
  });
}
