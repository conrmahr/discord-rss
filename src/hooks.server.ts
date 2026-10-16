// first import: logs any missing required env vars before anything uses them
import '$lib/server/check-env';
import type { ServerInit } from '@sveltejs/kit';
import { migrateLegacy, redis } from '$lib/redis';
import { startRunner, stopRunner } from '$lib/server/runner';

export { handle } from './auth';

// move v1 data to the current storage layout, then start the RSS poller alongside the web server
export const init: ServerInit = async () => {
	await migrateLegacy();
	await startRunner();
};

// adapter-node closes the http server on SIGTERM / SIGINT (e.g. a railway redeploy), then emits this;
// the runner timer and redis connection would otherwise keep the process alive until it's force-killed
process.once('sveltekit:shutdown', async () => {
	await stopRunner();
	await redis.quit();
});
