import { handleApi } from '@/app/lib/api-helper';
import { ProductModel } from '@/app/lib/models';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const { id } = await params;
    await ProductModel.findByIdAndDelete(id);
    return { message: 'Deleted' };
  });
}
