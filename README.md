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
- `DATABASE_NAME` (required) redis key the feed list is stored under
- `DISCORD_WEBHOOK_URL` (required) Discord webhook every feed posts to, e.g. `https://discord.com/api/webhooks/id/token`
- `AUTH_SECRET` (required) random generated secret
- `AUTH_TRUST_HOST` (required) boolean
- `AUTH_DISCORD_CLIENT_ID` (required) https://discord.com/developers/applications
  - Make sure to add `http://localhost:5173/auth/callback/discord`, or the production equivalant, to your OAuth2 redirects section.
- `AUTH_DISCORD_CLIENT_SECRET` (required) https://discord.com/developers/applications
- `DISCORD_AUTHORIZED_USERS` (required) comma-separated list of Discord user IDs for users allowed to access and modify the configuration

### Upgrading to v2

v2 posts every feed to one webhook instead of a webhook per feed. Set `DISCORD_WEBHOOK_URL` for both the web interface and the runner before deploying; the runner will not start without it. Webhook URLs saved on existing feeds are ignored and removed the next time you save from the web interface.

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/GAjtJO?referralCode=MlYK0h&utm_medium=integration&utm_source=template&utm_campaign=generic)

## Screenshots

![](./static/discord-rss-web.png)
![](./static/discord-rss-runner.png)
![](./static/discord-rss-webhook.png)

## Credits

- [@3ventic](https://github.com/3ventic) For building the original version
- [@javorszky](https://github.com/javorszky) & [@cassidoo](https://github.com/cassidoo) For inspiration and putting it to good use
