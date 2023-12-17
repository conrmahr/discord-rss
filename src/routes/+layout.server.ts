import { get } from '$lib/redis/get';
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
export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.getSession();
	return {
		session: session,
		get: await getFeeds()
	};
};
