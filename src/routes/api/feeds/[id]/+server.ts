import { json } from '@sveltejs/kit';
import { deleteFeed, parseFeed, saveFeed } from '$lib/redis';
import { requireAuthorized } from '$lib/server/authorized';

// create or update one feed
export const PUT = async ({ params, request, locals }) => {
	const denied = await requireAuthorized(locals);
	if (denied) return denied;

	const feed = parseFeed({ ...(await request.json()), id: params.id });
	if (!feed) {
		return json({ error: 'Invalid feed data' }, { status: 400 });
	}
	// the runner owns lastStatus; the ui only sets the last post fields
	delete feed.lastStatus;

	await saveFeed(feed);
	return json({ feed });
};

export const DELETE = async ({ params, locals }) => {
	const denied = await requireAuthorized(locals);
	if (denied) return denied;

	await deleteFeed(params.id);
	return new Response(null, { status: 204 });
};
