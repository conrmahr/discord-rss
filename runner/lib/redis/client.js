import dotenv from 'dotenv';
dotenv.config();
import { Redis } from 'ioredis';
if (!process.env.REDIS_URL) {
    throw new Error('Missing REDIS_URL');
}
export const redis = new Redis(process.env.REDIS_URL);
