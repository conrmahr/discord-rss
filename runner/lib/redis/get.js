import { redis } from './client.js';
/**
 * Retrieves a key's value from Redis.
 *
 * @param key - The key to use for retrieving the subscriptions.
 * @returns The data or empty string if not found or on error.
 */
export const get = async (key) => {
    try {
        const data = await redis.get(key);
        if (!data)
            return null;
        return JSON.parse(data);
    }
    catch (e) {
        console.error(`Error get response: ${e} Key: ${key}`);
        return null;
    }
};
