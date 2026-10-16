export type Feed = {
	id: string;
	url: string;
	website: string;
	name: string;
	thumbnail: string;
	author: string;
	status: boolean;
	updated: string;
	updatedDate?: string;
	updatedTime?: string;
	lastPostedUrl?: string;
	lastStatus?: number; // http status of the last feed fetch, 0 for network error, timeout or bad xml
};

// stored in redis as two parts: config is edited in the ui, state is written by the runner
export type FeedConfig = Pick<
	Feed,
	'id' | 'url' | 'website' | 'name' | 'thumbnail' | 'author' | 'status'
>;
export type FeedState = Partial<Pick<Feed, 'updated' | 'lastPostedUrl' | 'lastStatus'>>;

export type Settings = {
	interval: number; // minutes between polls
	paused: boolean; // paused from the ui; RUNNER_ENABLED=false still overrides
};

export type DiscordPost = {
	name: string;
	title: string;
	url: string;
};
