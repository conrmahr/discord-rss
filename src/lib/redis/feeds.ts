import { redis } from './client.js';
import type { Feed, FeedConfig, FeedState, Settings } from '../../types.js';

// all keys are prefixed with DATABASE_NAME so several environments can share one redis
const prefix = () => process.env.DATABASE_NAME!;
const keys = {
	// hash: feed id -> FeedConfig json, written by the web ui
	config: () => `${prefix()}:config`,
	// hash per feed: updated / lastPostedUrl / lastStatus, written by the runner (and the ui's last post fields)
	state: (id: string) => `${prefix()}:state:${id}`,
	// json: Settings
	settings: () => `${prefix()}:settings`,
	// v1 stored the whole feed array as one json string under DATABASE_NAME itself
	legacy: () => prefix(),
	legacyBackup: () => `${prefix()}:v1-backup`
};

const DEFAULT_INTERVAL = 15;

// pick the known config / state fields, dropping anything else (e.g. v1's per-feed webhook)
const toConfig = (feed: FeedConfig): FeedConfig => ({
	id: feed.id,
	url: feed.url,
	website: feed.website,
	name: feed.name,
	thumbnail: feed.thumbnail ?? '',
	author: feed.author ?? '',
	status: feed.status
});

const toStateFields = (state: FeedState) => {
	const fields: Record<string, string> = {};
	if (state.updated !== undefined) fields.updated = state.updated;
	if (state.lastPostedUrl !== undefined) fields.lastPostedUrl = state.lastPostedUrl;
	if (state.lastStatus !== undefined) fields.lastStatus = String(state.lastStatus);
	return fields;
};

// validate an unknown value (api body, import file, v1 data) as a feed
export const parseFeed = (data: unknown): (FeedConfig & FeedState) | null => {
	if (typeof data !== 'object' || data === null) return null;
	const item = data as Record<string, unknown>;
	const isString = (key: string) => typeof item[key] === 'string';
	const isOptionalString = (key: string) => item[key] === undefined || isString(key);
	if (
		!isString('id') ||
		!item.id ||
		!isString('url') ||
		!isString('website') ||
		!isString('name')
	) {
		return null;
	}
	if (typeof item.status !== 'boolean') return null;
	if (!['thumbnail', 'author', 'updated', 'lastPostedUrl'].every(isOptionalString)) return null;
	if (item.lastStatus !== undefined && typeof item.lastStatus !== 'number') return null;
	// state fields left out are left unchanged when saved
	return {
		...toConfig(item as unknown as Feed),
		updated: item.updated as string | undefined,
		lastPostedUrl: item.lastPostedUrl as string | undefined,
		lastStatus: item.lastStatus as number | undefined
	};
};

// every feed with its state merged in
export const getFeeds = async (): Promise<Feed[]> => {
	const configs = await redis.hgetall(keys.config());
	const ids = Object.keys(configs);
	if (!ids.length) return [];

	const pipeline = redis.pipeline();
	for (const id of ids) pipeline.hgetall(keys.state(id));
	const states = (await pipeline.exec()) ?? [];

	return ids.map((id, i) => {
		const state = (states[i]?.[1] ?? {}) as Record<string, string>;
		return {
			...(JSON.parse(configs[id]) as FeedConfig),
			updated: state.updated ?? '',
			lastPostedUrl: state.lastPostedUrl,
			lastStatus: state.lastStatus === undefined ? undefined : Number(state.lastStatus)
		};
	});
};

// save one feed's config, plus whichever state fields it carries
export const saveFeed = async (feed: FeedConfig & FeedState) => {
	const multi = redis.multi().hset(keys.config(), feed.id, JSON.stringify(toConfig(feed)));
	const fields = toStateFields(feed);
	if (Object.keys(fields).length) multi.hset(keys.state(feed.id), fields);
	await multi.exec();
};

// update only the given state fields; skips feeds deleted from the ui mid-poll
export const saveFeedState = async (id: string, state: FeedState) => {
	if (!(await redis.hexists(keys.config(), id))) return;
	const fields = toStateFields(state);
	if (Object.keys(fields).length) await redis.hset(keys.state(id), fields);
};

export const deleteFeed = async (id: string) => {
	await redis.multi().hdel(keys.config(), id).del(keys.state(id)).exec();
};

// settings saved from the ui. a new install (nothing saved yet) starts paused, so the interval can be
// set before anything posts. INTERVAL / RUNNER_ENABLED env vars override these (src/lib/server/runner.ts)
export const getSettings = async (): Promise<Settings> => {
	const raw = await redis.get(keys.settings());
	if (raw === null) return { interval: DEFAULT_INTERVAL, paused: true };
	let stored: Record<string, unknown> = {};
	try {
		stored = JSON.parse(raw);
	} catch {
		// unreadable settings fall back to the defaults
	}
	return {
		interval: isValidInterval(stored.interval) ? stored.interval : DEFAULT_INTERVAL,
		paused: stored.paused !== false
	};
};

export const saveSettings = async (settings: Settings) => {
	await redis.set(keys.settings(), JSON.stringify(settings));
};

// interval is whole minutes, 1 minute to 1 day
export const isValidInterval = (value: unknown): value is number =>
	Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 1440;

// validate an unknown value as settings
export const parseSettings = (data: unknown): Settings | null => {
	if (typeof data !== 'object' || data === null) return null;
	const { interval, paused } = data as Record<string, unknown>;
	if (!isValidInterval(interval) || typeof paused !== 'boolean') return null;
	return { interval, paused };
};

// one-time move from v1's single json key; keeps the old value as DATABASE_NAME:v1-backup
export const migrateLegacy = async () => {
	if ((await redis.type(keys.legacy())) !== 'string') return;
	if (await redis.exists(keys.config())) {
		console.log(`⚠️ skipping v1 migration: ${keys.config()} already exists`);
		return;
	}

	let data: unknown;
	try {
		data = JSON.parse((await redis.get(keys.legacy())) ?? '[]');
	} catch {
		console.error(`🔴 v1 migration failed: ${keys.legacy()} is not valid json`);
		return;
	}
	const feeds = Array.isArray(data) ? data.map(parseFeed) : [];
	if (!Array.isArray(data) || feeds.some((feed) => feed === null)) {
		console.error(`🔴 v1 migration failed: ${keys.legacy()} has invalid feeds, nothing changed`);
		return;
	}

	for (const feed of feeds) await saveFeed(feed!);
	await redis.rename(keys.legacy(), keys.legacyBackup());
	console.log(
		`📦 migrated ${feeds.length} feed(s) from v1, old data kept in ${keys.legacyBackup()}`
	);
};
