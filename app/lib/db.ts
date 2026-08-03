import mongoose from 'mongoose';

// Cache the connection promise on globalThis so Next.js hot reloads and
// concurrent requests during a cold start share one connect() instead of each
// opening their own pool.
const globalForMongoose = globalThis as unknown as {
  _mongooseConn?: Promise<typeof mongoose>;
  _adminSeeded?: boolean;
};

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not defined');

  if (!globalForMongoose._mongooseConn) {
    globalForMongoose._mongooseConn = mongoose
      .connect(process.env.MONGO_URI, {
        // A few agents at a time — a small pool is plenty and keeps Atlas
        // connection churn down on serverless.
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((e) => {
        // Don't cache a failed connect, or every later request reuses the
        // rejection and the app stays down until redeploy.
        globalForMongoose._mongooseConn = undefined;
        throw e;
      });
  }

  await globalForMongoose._mongooseConn;

  // Seed at most once per process — it was previously an extra User.findOne
  // on every cold start.
  if (!globalForMongoose._adminSeeded) {
    globalForMongoose._adminSeeded = true;
    await seedAdminUser();
  }
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
