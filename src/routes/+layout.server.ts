import { get } from '$lib/redis/get';
import { isAuthorized } from '$lib/server/authorized';
import { DATABASE_NAME } from '$env/static/private';

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
// feeds (including webhook tokens) are only sent to authorized users; anything returned
// here is serialized into the page HTML and /__data.json regardless of what renders
export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	return {
		session: session,
		get: isAuthorized(session?.user?.id) ? await getFeeds() : []
	};
};
