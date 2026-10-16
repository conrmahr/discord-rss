import Parser from 'rss-parser';
import { get, getFeeds, saveFeedState, set } from '../lib/redis/index.js';
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
	try {
		const subs = await getFeeds(); // get current subs
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
				subs[i].lastStatus = 200; // parseURL only resolves on a status below 300
				feed.items.sort((a, b) => new Date(a.isoDate!).getTime() - new Date(b.isoDate!).getTime()); // sort oldest post to newest

				// if updated is blank, set it to last feed and skip
				if (!Number.isInteger(Date.parse(subs[i].updated))) {
					const lastItem = feed.items.length ? feed.items[feed.items.length - 1] : null;
					subs[i].updated = lastItem?.isoDate ?? '';
					console.log(`	*️⃣ first check\n`);
					continue;
				}

				// filter posts
				const items = feed.items
					.filter((item) => item.isoDate) // check for isoDate set
					.filter(
						(item) =>
							toMinutes(new Date(item.isoDate!)) <= toMinutes(new Date()) && // isoDate must not be in the future
							new Date(item.isoDate!).getTime() > new Date(subs[i].updated).getTime() // isoDate must be after last updated
					)
					.filter((item) => !subs[i].lastPostedUrl || item.link !== subs[i].lastPostedUrl); // deduplicate by link
				// check for posts
				if (items.length > 0) {
					console.log(`	🎉 ${items.length} new post(s) found!\n`);
					let posts: DiscordPost[] = [];
					// loop through posts
					for (const item of items) {
						try {
							subs[i].updated = item.isoDate!; // set updated to feed isoDate
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
				// rss-parser rejects non-2xx responses with "Status code <n>"
				const match = /^Status code (\d+)$/.exec((e as Error).message);
				subs[i].lastStatus = match ? Number(match[1]) : 0; // 0 = network error, timeout or bad xml
				console.error(`🔴 error fetching ${subs[i].name}`, e);
				continue;
			} finally {
				// save this feed's progress now, so ui edits to other feeds are never overwritten
				await saveFeedState(subs[i].id, subs[i]);
			}
		}
	} catch (e) {
		console.error('🔴 error processing', e);
	} finally {
		await set('processing', false);
		console.log(`[${new Date().toISOString()}] ended processing\n----\n`);
	}
};

const MAX_RETRIES = 3;

// fetch errors can include the url (e.g. "Failed to parse URL from …" for a malformed
// DISCORD_WEBHOOK_URL); replace it so the webhook token never reaches the logs
const withoutWebhookUrl = (error: unknown) => {
	const url = process.env.DISCORD_WEBHOOK_URL;
	const text = (e: unknown) => (e instanceof Error ? e.message : String(e));
	const cause = error instanceof Error && error.cause ? ` (${text(error.cause)})` : '';
	const message = text(error) + cause; // e.g. "fetch failed (getaddrinfo ENOTFOUND …)"
	return new Error(url ? message.replaceAll(url, '<DISCORD_WEBHOOK_URL>') : message);
};

// post to discord webhook, waiting and retrying when rate limited
const postToWebhook = async (data = {}, attempt = 1): Promise<{ content?: string }> => {
	let response: Response;
	try {
		response = await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
			method: 'POST',
			headers: {
				'Content-type': 'application/json;'
			},
			body: JSON.stringify(data)
		});
	} catch (error) {
		throw withoutWebhookUrl(error);
	}

	// all feeds share one webhook, so a busy run can hit discord's per-webhook rate limit
	if (response.status === 429 && attempt <= MAX_RETRIES) {
		const { retry_after } = await response.json(); // seconds
		const wait = Math.ceil((retry_after ?? 1) * 1000);
		console.log(`	⏳ rate limited, retrying in ${wait}ms (attempt ${attempt}/${MAX_RETRIES})\n`);
		await new Promise((resolve) => setTimeout(resolve, wait));
		return postToWebhook(data, attempt + 1);
	}

	if (!response.ok) {
		throw new Error(`webhook responded ${response.status}: ${await response.text()}`);
	}

	return response.json();
};

const executeHook = async (feed: Feed, posts: DiscordPost[]) => {
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

		await postToWebhook({ content: content })
			.then((json) => {
				console.log(`📬 successfully posted:\n ${json.content}\n`); // handle success
			})
			.catch((error) => {
				console.error(`🔴 ${error}`); // handle errors
			});
	}
};
