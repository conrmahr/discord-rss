import { json } from '@sveltejs/kit';
import { parseSettings, saveSettings } from '$lib/redis';
import { requireAuthorized } from '$lib/server/authorized';
import { scheduleRunner } from '$lib/server/runner';

// save the poll interval / pause setting and reschedule the runner
export const PUT = async ({ request, locals }) => {
	const denied = await requireAuthorized(locals);
	if (denied) return denied;

	const settings = parseSettings(await request.json());
	if (!settings) {
		return json(
			{ error: 'Interval must be a whole number of minutes from 1 to 1440' },
			{ status: 400 }
		);
	}

	await saveSettings(settings);
	await scheduleRunner();
	return json({ settings });
};
