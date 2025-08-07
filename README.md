# Discord RSS Feed Manager (Forked)

Self-hosted RSS feed fetching and posting to Discord webhooks with web a management UI.

## Usage

### Development

- Install Node >=22 and pnpm, and run `pnpm install`.
- For the web interface run `pnpm run check` and `pnpm run dev`.
- For the RSS poller run `pnpm run build:runner` and `pnpm run runner`.

### Configuration

The service can be configured using environment variables:

- `INTERVAL` (default 15) minutes between checks
- `REDIS_URL` (required) redis connect url
- `AUTH_SECRET` (required) random generated secret
- `AUTH_TRUST_HOST` (required) boolean
- `AUTH_DISCORD_CLIENT_ID` (required) https://discord.com/developers/applications
  - Make sure to add `http://localhost:5173/auth/callback/discord`, or the production equivalant, to your OAuth2 redirects section.
- `AUTH_DISCORD_CLIENT_SECRET` (required) https://discord.com/developers/applications
- `DISCORD_AUTHORIZED_USERS` (required) comma-separated list of Discord user IDs for users allowed to access and modify the configuration

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/3li6Gg?referralCode=MlYK0h)

## Screenshots

![](./static/discord-rss-web.png)
![](./static/discord-rss-runner.png)
![](./static/discord-rss-webhook.png)

## Credits

- [@3ventic](https://github.com/3ventic) For building the original version
- [@javorszky](https://github.com/javorszky) & [@cassidoo](https://github.com/cassidoo) For inspiration and putting it to good use
