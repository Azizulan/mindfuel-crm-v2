import { handleApi, err } from '@/app/lib/api-helper';
import { User } from '@/app/lib/models';
import { formatUserResponse } from '@/app/lib/helpers';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handleApi(async () => {
    const { userId } = await params;
    const user = await User.findById(userId);
    if (!user) return err('Not found', 404);
    const body = await req.json();
    if (body.status) user.status = body.status;
    if (body.shiftStart !== undefined) user.shiftStart = Number(body.shiftStart);
    if (body.shiftEnd !== undefined) user.shiftEnd = Number(body.shiftEnd);
    await user.save();
    return formatUserResponse(user);
  });
}
