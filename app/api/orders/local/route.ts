import { NextResponse } from 'next/server';
import { handleApi } from '@/app/lib/api-helper';
import { LocalOrder } from '@/app/lib/models';

export async function GET() {
  return handleApi(async () => {
    const orders = await LocalOrder.find({ status: 'pending_approval' }).sort({ createdAt: -1 });
    return orders;
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const order = new LocalOrder(await req.json());
    await order.save();
    return NextResponse.json(order, { status: 201 });
  });
}
