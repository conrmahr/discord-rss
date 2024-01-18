import { json } from '@sveltejs/kit';
import { set } from '$lib/redis/';
import { DATABASE_NAME } from '$env/static/private';

// build POST endpoint to save data from web
export const POST = async ({ request }) => {
	const data = await request.json();

	const response = await set(DATABASE_NAME!, data);

	return json({ response }, { status: 201 });
};
