import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { handleApi } from '@/app/lib/api-helper';
import { User } from '@/app/lib/models';
import { formatUserResponse } from '@/app/lib/helpers';

export async function POST(req: Request) {
  return handleApi(async () => {
    const { name, email, password } = await req.json();
    const existing = await User.findOne({ email });
    if (existing) return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    const hash = await bcrypt.hash(password, 10);
    const saved = await new User({ name: name || email, email, password: hash, role: 'Sales Executive' }).save();
    return NextResponse.json(formatUserResponse(saved), { status: 201 });
  });
}
