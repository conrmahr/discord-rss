import type { ServerInit } from '@sveltejs/kit';
import { startRunner } from '$lib/server/runner';

export { handle } from './auth';

// start the RSS poller alongside the web server
export const init: ServerInit = async () => {
	await startRunner();
};
