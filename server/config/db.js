import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGO_URI is not set. Create server/.env (see README), or run `npm run dev:memory`.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
}
