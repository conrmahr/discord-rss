import { handleFeeds } from './listener/listener.js';
import { set } from './lib/redis/index.js';

await set('processing', false);

const MINUTE = 60 * 1000;
const SECONDS =
	typeof process.env.INTERVAL === 'undefined'
		? 15 * MINUTE
		: parseInt(process.env.INTERVAL) * MINUTE;
setInterval(handleFeeds, SECONDS); // set delay and run listener
