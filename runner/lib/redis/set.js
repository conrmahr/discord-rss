import { redis } from './client.js';
/**
 * Saves subscriptions to a key in Redis.
 *
 * @param key - The key to use for storing the response.
 * @param data - The data to save.
 */
export const set = async (key, data) => {
    try {
        const serializedData = JSON.stringify(data);
        await redis.set(key, serializedData);
    }
    catch (e) {
        console.error(`Error set response: ${e}`);
    }
};
