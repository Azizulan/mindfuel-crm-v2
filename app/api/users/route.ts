import { handleApi } from '@/app/lib/api-helper';
import { User } from '@/app/lib/models';
import { formatUserResponse } from '@/app/lib/helpers';

export async function GET() {
  return handleApi(async () => {
    const users = await User.find({});
    return users.map(formatUserResponse);
  });
}
