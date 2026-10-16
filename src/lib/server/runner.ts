import { env } from '$env/dynamic/private';
import { handleFeeds } from '../../listener/listener.js';
import { getSettings, isValidInterval, set } from '$lib/redis';

const MINUTE = 60 * 1000;

type RunnerState = {
	timer?: ReturnType<typeof setInterval>;
	nextPollAt: number | null; // epoch ms of the next scheduled handleFeeds call, null if not scheduled
	polling: boolean; // a handleFeeds call is in progress
	poll?: Promise<void>; // the in-progress handleFeeds call, so shutdown can wait for it
};

// the poller runs inside the web server; keep its state on globalThis so a dev
// hot reload of this module replaces the old interval instead of adding another
declare global {
	var discordRssRunner: RunnerState | undefined;
}

const runner = () => (globalThis.discordRssRunner ??= { nextPollAt: null, polling: false });

// what decides whether the runner runs, other than the ui's pause setting
// (no-webhook: DISCORD_WEBHOOK_URL is missing). same rules in every environment, `pnpm dev` included
export type RunnerLock = 'no-webhook' | 'env-off' | 'env-on' | null;

// the runner's effective config: a set env var wins over the ui's saved setting, and a new install
// (nothing saved) starts paused. RUNNER_ENABLED=true/false forces it on/off; INTERVAL fixes the interval
export const getRunnerConfig = async () => {
	const settings = await getSettings();
	// same rule as check-env.ts: whole minutes only, anything else is ignored (and logged at startup)
	const envInterval = /^\d+$/.test(env.INTERVAL ?? '') ? Number(env.INTERVAL) : NaN;
	const intervalFromEnv = isValidInterval(envInterval);

	let lock: RunnerLock = null;
	if (!env.DISCORD_WEBHOOK_URL) lock = 'no-webhook';
	else if (env.RUNNER_ENABLED === 'false') lock = 'env-off';
	else if (env.RUNNER_ENABLED === 'true') lock = 'env-on';

	return {
		settings,
		interval: intervalFromEnv ? envInterval : settings.interval,
		intervalFromEnv,
		lock,
		running: lock === 'env-on' || (lock === null && !settings.paused)
	};
};

// next poll time (null if nothing is scheduled) and whether a poll is in progress
export const getRunnerStatus = () => ({
	nextPollAt: runner().nextPollAt,
	polling: runner().polling
});

// (re)start the poll timer from the current settings; called at boot and when settings change
export const scheduleRunner = async () => {
	const state = runner();
	clearInterval(state.timer);
	state.timer = undefined;
	state.nextPollAt = null;

	const { interval, running } = await getRunnerConfig();
	if (!running) return;

	const ms = interval * MINUTE;
	state.nextPollAt = Date.now() + ms;
	// set delay and run listener
	state.timer = setInterval(() => {
		state.nextPollAt = Date.now() + ms;
		state.polling = true;
		state.poll = handleFeeds().finally(() => {
			state.polling = false;
			state.poll = undefined;
		});
	}, ms);
	console.log(`▶️ runner scheduled, checking feeds every ${interval} minute(s)`);
};

// stop scheduling polls and wait (up to `timeout` ms) for one already running to save its progress
export const stopRunner = async (timeout = 20_000) => {
	const state = runner();
	clearInterval(state.timer);
	state.timer = undefined;
	state.nextPollAt = null;
	if (state.poll) {
		console.log('⏳ waiting for the current poll to finish');
		// unref: the safety timeout mustn't keep the process alive once the poll has finished
		await Promise.race([
			state.poll,
			new Promise((resolve) => setTimeout(resolve, timeout).unref())
		]);
	}
};

const LOCK_MESSAGES: Record<Exclude<RunnerLock, null>, string> = {
	'no-webhook': '🔴 runner off: missing DISCORD_WEBHOOK_URL',
	'env-off': '⏸️ runner off: RUNNER_ENABLED=false',
	'env-on': '▶️ runner forced on: RUNNER_ENABLED=true'
};

export const startRunner = async () => {
	const { lock, running, settings } = await getRunnerConfig();
	if (lock) console.log(LOCK_MESSAGES[lock]);
	else if (settings.paused) console.log('⏸️ runner paused: resume it from the web ui');
	if (running) await set('processing', false); // clear a flag left by a crash mid-poll
	await scheduleRunner();
};
