import { json } from '@sveltejs/kit';
import { set } from '$lib/redis/';
import { DATABASE_NAME, DISCORD_AUTHORIZED_USERS } from '$env/static/private';
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
			typeof item.webhook === 'string' &&
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

	const approved = DISCORD_AUTHORIZED_USERS?.split(',').map((id) => id.trim()) || [];
	if (!approved.includes(session.user.id)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const data = await request.json();

	if (!isValidFeedArray(data)) {
		return json({ error: 'Invalid feed data' }, { status: 400 });
	}

	const response = await set(DATABASE_NAME!, data);

	return json({ response }, { status: 201 });
};
