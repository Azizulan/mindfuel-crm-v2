import { NextResponse } from 'next/server';
import { handleApi } from '@/app/lib/api-helper';
import { ProductModel } from '@/app/lib/models';
import { mapToId } from '@/app/lib/helpers';

export async function GET() {
  return handleApi(async () => {
    const products = await ProductModel.find({});
    return products.map(mapToId);
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const product = new ProductModel(await req.json());
    await product.save();
    return NextResponse.json(mapToId(product), { status: 201 });
  });
}
