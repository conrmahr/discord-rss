import Parser from 'rss-parser';

const parser = new Parser();

// check that a guessed url actually exists before suggesting it
const exists = async (url: string) => {
	try {
		const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
		return response.ok;
	} catch {
		return false;
	}
};

export type Discovered = {
	name: string;
	website: string;
	thumbnail: string;
	updated: string;
	lastPostedUrl: string;
};

// read a feed and suggest values for the subscription form; throws if the feed can't be read
export const discover = async (feedUrl: URL): Promise<Discovered> => {
	const feed = await parser.parseURL(feedUrl.href);

	// channel link, resolved against the feed url, falling back to the feed's origin;
	// atom feeds without an alternate link give the feed's own url, which isn't a website
	let website = feedUrl.origin;
	try {
		if (feed.link) {
			const link = new URL(feed.link, feedUrl);
			const isFeedItself =
				link.host === feedUrl.host &&
				link.pathname === feedUrl.pathname &&
				link.search === feedUrl.search;
			if (!isFeedItself) website = link.href;
		}
	} catch {
		// keep the origin
	}

	// feed image, then podcast artwork, then the site's favicon if it exists
	let thumbnail = feed.image?.url || feed.itunes?.image || '';
	if (!thumbnail) {
		const favicon = new URL('/favicon.ico', website).href;
		if (await exists(favicon)) thumbnail = favicon;
	}

	// most recent post, so the runner only posts items published after it
	const latest = feed.items
		.filter((item) => item.isoDate)
		.sort((a, b) => new Date(b.isoDate!).getTime() - new Date(a.isoDate!).getTime())[0];

	return {
		name: feed.title?.trim() ?? '',
		website,
		thumbnail,
		updated: latest?.isoDate ?? '',
		lastPostedUrl: latest?.link ?? ''
	};
};
