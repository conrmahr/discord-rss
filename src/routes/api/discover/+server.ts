import { json } from '@sveltejs/kit';
import { isAuthorized } from '$lib/server/authorized';
import { discover } from '$lib/server/discover';

// read a feed url and suggest values for the subscription form
export const POST = async ({ request, locals }) => {
	const session = await locals.auth();

	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!isAuthorized(session.user.id)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { url } = await request.json();

	let feedUrl: URL;
	try {
		feedUrl = new URL(url);
		if (!['http:', 'https:'].includes(feedUrl.protocol)) throw new Error();
	} catch {
		return json({ error: 'Enter a valid http(s) feed URL' }, { status: 400 });
	}

	try {
		return json(await discover(feedUrl));
	} catch (e) {
		// network errors (e.g. ECONNREFUSED) can have an empty message, so fall back to the code;
		// xml parse errors add line/column details on later lines
		const { message, code } = e as Error & { code?: string };
		return json(
			{ error: `Couldn't read feed: ${message.split('\n')[0] || code}` },
			{ status: 422 }
		);
	}
};
