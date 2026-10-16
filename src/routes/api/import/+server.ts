import { json } from '@sveltejs/kit';
import { parseFeed, parseSettings, saveFeed, saveSettings } from '$lib/redis';
import { requireAuthorized } from '$lib/server/authorized';
import { scheduleRunner } from '$lib/server/runner';

// merge an export file into this environment: feeds are added or replaced by id, others are kept.
// also accepts a plain array of feeds, i.e. the value of a v1 DATABASE_NAME key
export const POST = async ({ request, locals }) => {
	const denied = await requireAuthorized(locals);
	if (denied) return denied;

	let data: unknown;
	try {
		data = await request.json();
	} catch {
		return json({ error: 'File is not valid JSON' }, { status: 400 });
	}

	const isExport = typeof data === 'object' && data !== null && !Array.isArray(data);
	const rawFeeds = isExport ? (data as { feeds?: unknown }).feeds : data;
	if (!Array.isArray(rawFeeds)) {
		return json({ error: 'No feeds found in file' }, { status: 400 });
	}

	// validate everything before writing anything
	const feeds = rawFeeds.map(parseFeed);
	const invalid = feeds.filter((feed) => feed === null).length;
	if (invalid) {
		return json(
			{ error: `${invalid} feed(s) in the file are invalid, nothing imported` },
			{ status: 400 }
		);
	}
	const settings = isExport ? (data as { settings?: unknown }).settings : undefined;
	const parsedSettings = settings === undefined ? null : parseSettings(settings);
	if (settings !== undefined && !parsedSettings) {
		return json({ error: 'Settings in the file are invalid, nothing imported' }, { status: 400 });
	}

	for (const feed of feeds) await saveFeed(feed!);
	if (parsedSettings) {
		await saveSettings(parsedSettings);
		await scheduleRunner();
	}

	return json({ imported: feeds.length, settings: !!parsedSettings });
};
