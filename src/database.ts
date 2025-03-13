import mongoose from 'mongoose';
import { MONGODB_URI } from './config';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB bağlantısı başarılı!");
  } catch (error) {
    console.error("❌ MongoDB bağlantı hatası:", error);
    process.exit(1);
  }
};
