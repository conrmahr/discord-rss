import { handleFeeds } from './listener/listener.js';
import { set } from './lib/redis/index.js';

// all feeds post to a single webhook set in the environment
if (!process.env.DISCORD_WEBHOOK_URL) {
	throw new Error('Missing DISCORD_WEBHOOK_URL');
}

await set('processing', false);

const MINUTE = 60 * 1000;
const SECONDS =
	typeof process.env.INTERVAL === 'undefined'
		? 15 * MINUTE
		: parseInt(process.env.INTERVAL) * MINUTE;
setInterval(handleFeeds, SECONDS); // set delay and run listener
