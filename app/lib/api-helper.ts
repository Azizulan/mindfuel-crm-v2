import { NextResponse } from 'next/server';
import { connectDB } from './db';

export async function handleApi<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    await connectDB();
    const result = await fn();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ message: err.message || 'Server error' }, { status: 500 });
  }
}

export function err(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}
