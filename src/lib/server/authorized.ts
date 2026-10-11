import { env } from '$env/dynamic/private';

// parse DISCORD_AUTHORIZED_USERS into a list of Discord user IDs
export const getAuthorizedUsers = (): string[] =>
	env.DISCORD_AUTHORIZED_USERS?.split(',')
		.map((id) => id.trim())
		.filter(Boolean) || [];

// check whether a Discord user ID is allowed to view and modify feeds
export const isAuthorized = (id: string | undefined | null): boolean =>
	!!id && getAuthorizedUsers().includes(id);
