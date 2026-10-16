import { getFeeds } from '$lib/redis';
import { extractChannel } from '$lib/helpers';
import { isAuthorized } from '$lib/server/authorized';
import { getRunnerConfig, getRunnerStatus } from '$lib/server/runner';
import { env } from '$env/dynamic/private';

import type { LayoutServerLoad } from './$types';

// past current feeds to session
// feeds are only sent to authorized users; anything returned here is serialized
// into the page HTML and /__data.json regardless of what renders
export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!isAuthorized(session?.user?.id)) {
		return {
			session,
			get: [],
			webhookId: null,
			settings: null,
			runner: null,
			nextPollIn: null,
			polling: false
		};
	}

	const [feeds, { settings, ...runner }] = await Promise.all([getFeeds(), getRunnerConfig()]);
	const { nextPollAt, polling } = getRunnerStatus();
	return {
		session: session,
		get: feeds,
		// only the webhook id, never the full url (it contains the token)
		webhookId: env.DISCORD_WEBHOOK_URL ? extractChannel(env.DISCORD_WEBHOOK_URL) : null,
		// what the ui saved, and what's in effect after env overrides (interval, lock, running)
		settings,
		runner,
		// ms until the next poll, relative so the client's clock doesn't matter; null if not scheduled
		nextPollIn: nextPollAt !== null ? Math.max(0, nextPollAt - Date.now()) : null,
		polling
	};
};
