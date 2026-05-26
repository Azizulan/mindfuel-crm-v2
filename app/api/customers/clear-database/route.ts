import bcrypt from 'bcryptjs';
import { handleApi, err } from '@/app/lib/api-helper';
import { Customer, User } from '@/app/lib/models';

export async function POST(req: Request) {
  return handleApi(async () => {
    const { password, adminEmail } = await req.json();
    const admin = await User.findOne({ email: adminEmail, role: 'Administrator' });
    if (!admin || !(await bcrypt.compare(password, admin.password)))
      return err('Invalid administrator password.', 401);
    await Customer.deleteMany({ followUpNotes: { $size: 0 } });
    await Customer.updateMany(
      { followUpNotes: { $exists: true, $not: { $size: 0 } } },
      {
        $set: {
          purchases: [],
          purchaseCount: 0,
          totalSpending: 0,
          lastPurchaseDate: null,
          purchaseHistory: '',
          valueRating: 'Low',
        },
      }
    );
    return { message: 'Database cleared. Outreach list preserved.' };
  });
}
