import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not defined');
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
  await seedAdminUser();
}

async function seedAdminUser() {
  try {
    const { User } = await import('./models');
    const adminEmail = 'azizulhakimzen@gmail.com';
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('Uniqpa5$word11177', 10);
      await new User({
        name: 'Admin',
        email: adminEmail,
        password: hash,
        role: 'Administrator',
        status: 'Active',
        shiftStart: 9,
        shiftEnd: 22,
      }).save();
    }
  } catch (e) {
    console.error('Seed admin error:', e);
  }
}
