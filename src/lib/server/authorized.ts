import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// parse DISCORD_AUTHORIZED_USERS into a list of Discord user IDs
export const getAuthorizedUsers = (): string[] =>
	env.DISCORD_AUTHORIZED_USERS?.split(',')
		.map((id) => id.trim())
		.filter(Boolean) || [];

// check whether a Discord user ID is allowed to view and modify feeds
export const isAuthorized = (id: string | undefined | null): boolean =>
	!!id && getAuthorizedUsers().includes(id);

// for api routes: an error response if the request isn't from an authorized user, otherwise null
export const requireAuthorized = async (locals: App.Locals) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!isAuthorized(session.user.id)) return json({ error: 'Forbidden' }, { status: 403 });
	return null;
};
