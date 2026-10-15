import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { handleFeeds } from '../../listener/listener.js';
import { set } from '$lib/redis';

const MINUTE = 60 * 1000;

// the poller runs inside the web server; keep its timer on globalThis so a dev
// hot reload of this module replaces the old interval instead of adding another
declare global {
	var discordRssRunner: ReturnType<typeof setInterval> | undefined;
}

// on by default in production, off by default in dev so `pnpm dev` doesn't post to discord
const isEnabled = () => {
	if (env.RUNNER_ENABLED === 'true') return true;
	if (env.RUNNER_ENABLED === 'false') return false;
	return !dev;
};

export const startRunner = async () => {
	if (globalThis.discordRssRunner) {
		clearInterval(globalThis.discordRssRunner);
		globalThis.discordRssRunner = undefined;
	}

	if (!isEnabled()) {
		console.log('⏸️ runner disabled (set RUNNER_ENABLED=true to enable)');
		return;
	}

	// all feeds post to a single webhook set in the environment
	if (!env.DISCORD_WEBHOOK_URL) {
		console.error('🔴 runner not started: missing DISCORD_WEBHOOK_URL');
		return;
	}

	await set('processing', false);

	const interval = env.INTERVAL ? parseInt(env.INTERVAL) * MINUTE : 15 * MINUTE;
	globalThis.discordRssRunner = setInterval(handleFeeds, interval); // set delay and run listener
	console.log(`▶️ runner started, checking feeds every ${interval / MINUTE} minute(s)`);
};
