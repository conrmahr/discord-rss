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

export type DiscordPost = {
	name: string;
	title: string;
	url: string;
};
