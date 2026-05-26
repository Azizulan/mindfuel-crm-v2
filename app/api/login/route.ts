import bcrypt from 'bcryptjs';
import { handleApi, err } from '@/app/lib/api-helper';
import { User } from '@/app/lib/models';
import { formatUserResponse } from '@/app/lib/helpers';

export async function POST(req: Request) {
  return handleApi(async () => {
    const { email, password } = await req.json();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    if (user.status !== 'Active')
      throw Object.assign(new Error('Account status: ' + user.status), { status: 403 });
    return formatUserResponse(user);
  });
}
