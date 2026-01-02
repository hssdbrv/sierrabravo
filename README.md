# sierrabravo

Telegram bot + Cloudflare Workers scheduled scraper.

Quick start

1. Install dependencies

```bash
npm install
```

2. Development (local Wrangler)

```bash
npm run dev
```

3. Deploy

```bash
npm run deploy
```

Notes

- Ensure `wrangler.toml` contains your D1 binding and `CHANNEL_ID` variable, and set secrets with `wrangler secret put BOT_TOKEN`.
- Manual endpoints:
  - POST `/__run_scheduled` — fetch prices and post to channel
  - POST `/__send_chart` — generate charts and send to channel
- The worker exports named `fetch` and `scheduled` functions (Cloudflare Workers module format).
- Cron: The worker cron should be configured to run hourly (e.g. `0 */1 * * *`). Charts are generated when the scheduled handler runs at 00:00 UTC.

Formatting & linting

- Run `npm run format` and `npm run lint` after installing dev dependencies.

Security

- Consider protecting manual endpoints with a shared secret.
- Rotate bot tokens/keys if previously committed.
