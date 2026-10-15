import { get } from '$lib/redis/get';
import { extractChannel } from '$lib/helpers';
import { isAuthorized } from '$lib/server/authorized';
import { getRunnerStatus } from '$lib/server/runner';
import { DATABASE_NAME } from '$env/static/private';
import { env } from '$env/dynamic/private';

import type { LayoutServerLoad } from './$types';

// get feeds on initial load
const getFeeds = async () => {
	const feeds = await get(DATABASE_NAME!);
	if (!feeds) {
		const fallback: string[] = [];
		return fallback;
	}
	return feeds;
};

// past current feeds to session
// feeds are only sent to authorized users; anything returned here is serialized
// into the page HTML and /__data.json regardless of what renders
export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	const authorized = isAuthorized(session?.user?.id);
	const { nextPollAt, polling } = getRunnerStatus();
	return {
		session: session,
		get: authorized ? await getFeeds() : [],
		// only the webhook id, never the full url (it contains the token)
		webhookId:
			authorized && env.DISCORD_WEBHOOK_URL ? extractChannel(env.DISCORD_WEBHOOK_URL) : null,
		// ms until the next poll, relative so the client's clock doesn't matter; null if not running
		nextPollIn: authorized && nextPollAt !== null ? Math.max(0, nextPollAt - Date.now()) : null,
		polling: authorized && polling
	};
};
