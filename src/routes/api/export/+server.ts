import { json } from '@sveltejs/kit';
import { getFeeds, getSettings } from '$lib/redis';
import { requireAuthorized } from '$lib/server/authorized';

const EXPORT_VERSION = 2;

// download every feed (with runner state) and the settings as one json file
export const GET = async ({ locals }) => {
	const denied = await requireAuthorized(locals);
	if (denied) return denied;

	const [feeds, settings] = await Promise.all([getFeeds(), getSettings()]);
	const date = new Date().toISOString().slice(0, 10);
	return json(
		{ version: EXPORT_VERSION, exportedAt: new Date().toISOString(), settings, feeds },
		{ headers: { 'Content-Disposition': `attachment; filename="discord-rss-${date}.json"` } }
	);
};
