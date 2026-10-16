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

// imported first by hooks.server.ts so the list is logged before anything uses the variables
dotenv.config();

const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
if (missing.length) {
	console.error(
		`🔴 Missing required environment variables: ${missing.join(', ')}. See .env.example.`
	);
}
