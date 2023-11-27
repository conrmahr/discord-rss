import Parser from 'rss-parser';
import { get, set } from '../lib/redis/index.js';
import { truncateString } from '../lib/helpers.js';
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
	const feeds = await get(process.env.DATABASE_NAME!); // get current feeds

	try {
		// if no feeds found, skip interval
		if (!feeds || !feeds.length) {
			console.log('🔴 no feeds found\n');
			return;
		}
		// loop through feeds
		for (let i = 0; i < feeds.length; i++) {
			console.log(`✅ ${feeds[i].name} [${feeds[i].updated}]\n`);
			// skip if status is set to false
			if (!feeds[i].status) {
				console.log(`⏭️ skipping not active ${feeds[i].name}\n`);
				continue;
			}
			// if updated is blank, set it to today and skip
			if (!Number.isInteger(Date.parse(feeds[i].updated))) {
				feeds[i].updated = new Date().toISOString();
				console.log(`*️⃣ first check ${feeds[i].name}\n`);
				continue;
			}

			const feed = await parser.parseURL(feeds[i].url); // fetch feed url
			// filter posts
			const items = feed.items
				.filter((item) => item.isoDate) // check for isoDate set
				.filter(
					(item) =>
						new Date(item.isoDate!).getTime() < new Date().getTime() && // isoDate must be less than current date/time
						new Date(item.isoDate!).getTime() > new Date(feeds[i].updated).getTime() // isoDate msut be greater than last updated
				)
				.sort((a, b) => new Date(a.isoDate!).getTime() - new Date(b.isoDate!).getTime()); // sort oldest post to newest
			// check for posts
			if (items.length > 0) {
				console.log(`🎉 ${items.length} new post(s) found!\n`);
				let posts: DiscordPost[] = [];
				// loop through posts
				for (const item of items) {
					try {
						feeds[i].updated = item.isoDate; // set updated to feed isoDate
						// set post meta
						const post: DiscordPost = {
							name: feeds[i].name,
							title: truncateString(item.title ?? '', 250),
							url: item.link!
						};
						posts.push(post); // store meta in array
						// send to webhook if it hits 10 posts
						if (posts.length === 10) {
							await executeHook(feeds[i], posts);
							posts = [];
						}
					} catch (e) {
						console.error('🔴 error posting 10 to webhook', e);
					}
				}
				// send to webhook
				if (posts.length > 0) {
					try {
						await executeHook(feeds[i], posts);
					} catch (e) {
						console.error('🔴 error posting to webhook', e);
					}
				}
			}
		}
	} catch (e) {
		console.error('🔴 error processing', e);
	} finally {
		// set feeds with last updated values
		await set(process.env.DATABASE_NAME!, feeds);
		await set('processing', false);
		console.log(`[${new Date().toISOString()}] ended processing\n////\n`);
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
		const titleText = post.title ? `:newspaper: *${post.title}*` : '';
		const authorText = feed.author ? ` by <@${feed.author}>\n` : '\n';
		const linkText = `\n${post.url}`;
		const content = feedText + titleText + authorText + linkText;

		await response(`${feed.webhook}?wait=true`, { content: content })
			.then((json) => {
				console.log(`📬 successfully posted: ${json.content}\n`); // handle success
			})
			.catch((error) => {
				console.error(`🔴 ${error}`); // handle errors
			});
	}
};
