import { handleApi } from '@/app/lib/api-helper';
import { LocalOrder } from '@/app/lib/models';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const { id } = await params;
    await LocalOrder.findByIdAndDelete(id);
    return { message: 'Order removed' };
  });
}
