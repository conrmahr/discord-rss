# Discord RSS Feed Manager (Forked)

Self-hosted RSS feed fetching and posting to Discord webhooks with web a management UI.

## Usage

### Development

- Install Node >=22 and pnpm, and run `pnpm install`.
- Run `pnpm run check` and `pnpm run dev`. The RSS poller runs inside the web server, but is off in dev so you don't post to Discord by accident; set `RUNNER_ENABLED=true` to turn it on.
- For production run `pnpm run build` and `pnpm run start`.

### Configuration

The service can be configured using environment variables. Missing required ones are listed in the server log at startup:

- `INTERVAL` (optional) minutes between checks. If set, it overrides the web interface's interval; otherwise the interval is set in the web interface (default 15)
- `RUNNER_ENABLED` (optional) `true` or `false` forces the runner on or off and overrides the web interface's Pause/Resume. If unset, Pause/Resume decides (except in `pnpm dev`, where it stays off)
- `REDIS_URL` (required) redis connect url
- `DATABASE_NAME` (required) prefix for this app's redis keys, so several environments can share one redis
- `DISCORD_WEBHOOK_URL` (required to post) Discord webhook every feed posts to, e.g. `https://discord.com/api/webhooks/id/token`. Without it the web interface still works, but the runner stays off
- `AUTH_SECRET` (required) random generated secret
- `AUTH_DISCORD_CLIENT_ID` (required) https://discord.com/developers/applications
  - Make sure to add `http://localhost:5173/auth/callback/discord`, or the production equivalant, to your OAuth2 redirects section.
- `AUTH_DISCORD_CLIENT_SECRET` (required) https://discord.com/developers/applications
- `DISCORD_AUTHORIZED_USERS` (required) comma-separated list of Discord user IDs for users allowed to access and modify the configuration

### Starting the runner

A new install starts **paused**, so nothing posts until you're ready: set the interval in the web interface and click **Resume**. Environment variables win over the web interface when they're set: `INTERVAL` fixes the interval and `RUNNER_ENABLED` forces the runner on or off.

### Moving between environments

Use **Export** in the web interface to download every feed, its progress (last post date, last posted URL, last HTTP status) and the settings as one JSON file, then **Import** it in the other environment. Import adds feeds or replaces ones with the same id and leaves the rest alone. It also accepts the old v1 format: the JSON value of a v1 `DATABASE_NAME` key.

Import also applies the exported interval and Pause/Resume setting, so importing an export from a running instance starts the runner (unless `RUNNER_ENABLED` overrides it). Environment variables, including the webhook, are never exported.

### Upgrading to v2

v2 posts every feed to one webhook instead of a webhook per feed. Set `DISCORD_WEBHOOK_URL` before deploying; feeds are not checked without it.

The RSS poller now runs inside the web server, so the separate runner service (`pnpm run runner`) is gone. Remove it from your deployment: its scripts no longer exist, and if you point it at `pnpm run start` instead, both services will poll and every post will be sent twice. Feeds are moved to the new storage layout automatically on first start; the old data is kept in redis as `DATABASE_NAME:v1-backup`, and webhook URLs saved on old feeds are dropped. v1 had no saved settings, so after upgrading the runner starts **paused**: set the interval and click **Resume** in the web interface.

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/GAjtJO?referralCode=MlYK0h&utm_medium=integration&utm_source=template&utm_campaign=generic)

## Screenshots

![](./static/discord-rss-web.png)
![](./static/discord-rss-runner.png)
![](./static/discord-rss-webhook.png)

## Credits

- [@3ventic](https://github.com/3ventic) For building the original version
- [@javorszky](https://github.com/javorszky) & [@cassidoo](https://github.com/cassidoo) For inspiration and putting it to good use
