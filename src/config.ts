import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

export const MONGODB_URI = process.env.MONGODB_URI!;
export const PORT = process.env.PORT || 5001;
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
