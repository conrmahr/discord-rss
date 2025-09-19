export type Feed = {
	id: string;
	url: string;
	website: string;
	webhook: string;
	name: string;
	thumbnail: string;
	author: string;
	status: boolean;
	updated: string;
};

export type DiscordPost = {
	name: string;
	title: string;
	url: string;
};
