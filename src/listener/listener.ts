import Parser from 'rss-parser';
import { get, set } from '../lib/redis/index.js';
import { toMinutes, truncateString } from '../lib/helpers.js';
import type { DiscordPost, Feed } from '../types.js';

const parser = new Parser();

export const handleFeeds = async () => {
	// check if process is still running
	if (await get('processing')) {
		console.log('still processing, skipping');
		return;
	}
	console.log(`[${new Date().toISOString()}] start processing\n`);
	await set('processing', true);
	const subs = await get(process.env.DATABASE_NAME!); // get current subs

	try {
		// if no subs found, skip interval
		if (!subs || !subs.length) {
			console.log('🔴 no subs found\n');
			return;
		}
		// loop through subs
		for (let i = 0; i < subs.length; i++) {
			console.log(`✅ ${subs[i].name} [${subs[i].updated}]\n`);
			// skip if status is set to false
			if (!subs[i].status) {
				console.log(`	⏭️ skipping not active\n`);
				continue;
			}

			try {
				const feed = await parser.parseURL(subs[i].url); // fetch feed url
				feed.items.sort((a, b) => new Date(a.isoDate!).getTime() - new Date(b.isoDate!).getTime()); // sort oldest post to newest

				// if updated is blank, set it to last feed and skip
				if (!Number.isInteger(Date.parse(subs[i].updated))) {
					const lastItem = feed.items.length ? feed.items[feed.items.length - 1] : null;
					subs[i].updated = lastItem?.isoDate ?? '';
					subs[i].lastPostedUrl = lastItem?.link ?? '';
					console.log(`	*️⃣ first check\n`);
					continue;
				}

				// filter posts
				const items = feed.items
					.filter((item) => item.isoDate) // check for isoDate set
					.filter(
						(item) =>
							toMinutes(new Date(item.isoDate!)) <= toMinutes(new Date()) && // isoDate must not be in the future
							toMinutes(new Date(item.isoDate!)) >= toMinutes(new Date(subs[i].updated)) // isoDate must be on or after last updated
					)
					.filter((item) => !subs[i].lastPostedUrl || item.link !== subs[i].lastPostedUrl); // deduplicate by link
				// check for posts
				if (items.length > 0) {
					console.log(`	🎉 ${items.length} new post(s) found!\n`);
					let posts: DiscordPost[] = [];
					// loop through posts
					for (const item of items) {
						try {
							subs[i].updated = item.isoDate; // set updated to feed isoDate
							// set post meta
							const post: DiscordPost = {
								name: subs[i].name,
								title: truncateString(item.title ?? '', 250),
								url: item.link!
							};
							posts.push(post); // store meta in array
							// send to webhook if it hits 10 posts
							if (posts.length === 10) {
								await executeHook(subs[i], posts);
								posts = [];
							}
						} catch (e) {
							console.error('🔴 error posting 10 to webhook', e);
						}
					}
					// send to webhook
					if (posts.length > 0) {
						try {
							await executeHook(subs[i], posts);
						} catch (e) {
							console.error('🔴 error posting to webhook', e);
						}
					}
					// store last posted URL for deduplication on next run
					subs[i].lastPostedUrl = items[items.length - 1].link;
				}
			} catch (e) {
				console.error(`🔴 error fetching ${subs[i].name}`, e);
				continue;
			}
		}
	} catch (e) {
		console.error('🔴 error processing', e);
	} finally {
		// set subs with last updated values
		await set(process.env.DATABASE_NAME!, subs);
		await set('processing', false);
		console.log(`[${new Date().toISOString()}] ended processing\n----\n`);
	}
};

const executeHook = async (feed: Feed, posts: DiscordPost[]) => {
	// post to discord api
	const response = async (url = '', data = {}) => {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-type': 'application/json;'
			},
			body: JSON.stringify(data)
		});

		return response.json();
	};
	// loop through post meta and format for webhook
	for (const post of posts) {
		const feedText = feed.name ? `### ${feed.name}\n` : '';
		const titleText = post.title ? `:newspaper: ${post.title}` : '';

		// format multiple Discord IDs as mentions
		let authorText = '';
		if (feed.author) {
			const discordIds = feed.author
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id);
			if (discordIds.length > 0) {
				const mentions = discordIds.map((id) => `<@${id}>`);
				authorText = ` by ${mentions.join(' ')}`;
			}
		}

		const linkText = `\n${post.url}`;
		const content = feedText + titleText + authorText + linkText;

		await response(`${feed.webhook}?wait=true`, { content: content })
			.then((json) => {
				console.log(`📬 successfully posted:\n ${json.content}\n`); // handle success
			})
			.catch((error) => {
				console.error(`🔴 ${error}`); // handle errors
			});
	}
};
