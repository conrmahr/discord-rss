import { json } from '@sveltejs/kit';
import { set } from '$lib/redis/';
import { isAuthorized } from '$lib/server/authorized';
import { DATABASE_NAME } from '$env/static/private';
import type { Feed } from '../../types';

// validate that the payload is an array of feed objects
const isValidFeedArray = (data: unknown): data is Feed[] => {
	if (!Array.isArray(data)) return false;
	return data.every(
		(item) =>
			typeof item === 'object' &&
			item !== null &&
			typeof item.id === 'string' &&
			typeof item.url === 'string' &&
			typeof item.website === 'string' &&
			typeof item.name === 'string' &&
			typeof item.status === 'boolean'
	);
};

// build POST endpoint to save data from web
export const POST = async ({ request, locals }) => {
	const session = await locals.auth();

	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!isAuthorized(session.user.id)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const data = await request.json();

	if (!isValidFeedArray(data)) {
		return json({ error: 'Invalid feed data' }, { status: 400 });
	}

	// drop per-feed webhooks left over from v1, the webhook now lives in DISCORD_WEBHOOK_URL
	for (const feed of data) {
		delete (feed as Feed & { webhook?: string }).webhook;
	}

	const response = await set(DATABASE_NAME!, data);

	return json({ response }, { status: 201 });
};
