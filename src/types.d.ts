export type Feed = {
	id: string;
	name: string;
	author: string;
	url: string;
	webhook: string;
	thumbnail: string;
	status: boolean;
	updated: string;
};

export type DiscordPost = {
	name: string;
	title: string;
	url: string;
};
