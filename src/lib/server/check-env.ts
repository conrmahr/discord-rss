import dotenv from 'dotenv';

// environment variables the server needs; DISCORD_WEBHOOK_URL is left out on purpose
// (without it the ui still works and the runner stays off)
const REQUIRED_ENV = [
	'REDIS_URL',
	'DATABASE_NAME',
	'AUTH_SECRET',
	'AUTH_DISCORD_CLIENT_ID',
	'AUTH_DISCORD_CLIENT_SECRET',
	'DISCORD_AUTHORIZED_USERS'
];

// optional overrides of the web ui's settings: leave them out (or commented out) to let the ui decide.
// if one is defined it needs a valid value; a blank or invalid one is ignored, and logged here
const OPTIONAL_OVERRIDES: Record<string, { valid: (value: string) => boolean; expected: string }> =
	{
		INTERVAL: {
			valid: (value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1440,
			expected: 'a whole number of minutes from 1 to 1440'
		},
		RUNNER_ENABLED: {
			valid: (value) => value === 'true' || value === 'false',
			expected: 'true or false'
		}
	};

// imported first by hooks.server.ts so the list is logged before anything uses the variables
dotenv.config();

const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
if (missing.length) {
	console.error(
		`🔴 Missing required environment variables: ${missing.join(', ')}. See .env.example.`
	);
}

for (const [name, { valid, expected }] of Object.entries(OPTIONAL_OVERRIDES)) {
	const value = process.env[name];
	if (value === undefined || valid(value)) continue;
	const problem = value.trim() ? `is "${value}"` : 'is set but empty';
	console.error(
		`🔴 ${name} ${problem}: expected ${expected}, or comment it out to let the web ui decide. Ignoring it.`
	);
}
