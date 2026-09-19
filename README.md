# Media Licker

> A production-oriented media delivery stack for Telegram: paste a supported media URL, choose a quality or audio format, and receive the resulting file directly in Telegram.

[![Live companion console](https://img.shields.io/badge/live-companion%20console-0f172a?style=flat-square&logo=vercel&logoColor=white)](https://medialicker.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![yt--dlp](https://img.shields.io/badge/yt--dlp-powered-111827?style=flat-square)](https://github.com/yt-dlp/yt-dlp)
[![Deploy on Railway](https://img.shields.io/badge/deploy-Railway-000000?style=flat-square&logo=railway&logoColor=white)](https://railway.app/)

Media Licker combines a polished web companion console with a containerized Telegram bot. The bot uses [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) to extract media, [`ffmpeg`](https://ffmpeg.org/) to remux or compress it when necessary, and Telegram to deliver the final video, audio track, or document.

The default deployment target is Railway. Optional companion services can provide a self-hosted Telegram Bot API endpoint for large uploads and a BgUtils Proof-of-Origin token provider for more reliable YouTube extraction from hosted environments.

> **Responsible use:** Only download, convert, and share media that you have the legal right to access and redistribute. Respect the terms of service, copyright, privacy, and applicable laws for every source.

## Contents

- [What is included](#what-is-included)
- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Deploy the bot to Railway](#deploy-the-bot-to-railway)
- [Environment variables](#environment-variables)
- [Optional large-file delivery](#optional-large-file-delivery)
- [Optional YouTube POT provider](#optional-youtube-pot-provider)
- [Run the bot locally](#run-the-bot-locally)
- [Use the bot](#use-the-bot)
- [Web companion console](#web-companion-console)
- [Project structure](#project-structure)
- [Development and verification](#development-and-verification)
- [Operational guidance](#operational-guidance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## What is included

### ReelDrop Telegram bot

The deployable bot lives in [`bot/`](./bot). It provides:

- URL extraction through `yt-dlp`.
- Support for YouTube, TikTok, Instagram, X, Reddit, Vimeo, Facebook, Twitch clips, and other `yt-dlp` extractors.
- Format choices including Best, 1080p, 720p, 480p, and MP3.
- Progress messages while a download is running.
- `sendVideo` / `sendAudio` delivery with document fallback.
- Oversize-file compression toward Telegram's public Bot API limit.
- Optional allowlisting through `ALLOWED_USER_IDS`.
- Long polling by default, with optional webhook mode.
- Optional MTProto/GramJS upload support for large files.
- Health and Telegram webhook endpoints for deployment checks.

### Web companion console

The root application is a TanStack Start + React companion console. It provides:

- A product overview for ReelDrop.
- An interactive, client-side Telegram-style demo.
- Railway deployment instructions.
- A downloadable bot bundle at `/reeldrop-bot.zip`.
- Responsive layouts for desktop and mobile.

The browser demo is intentionally a preview experience; it does not download or persist user media. The actual media workflow runs in the Telegram bot service.

### Optional infrastructure services

- [`telegram-bot-api/`](./telegram-bot-api): self-hosted Telegram Bot API server for local mode and larger uploads.
- [`bgutil-provider/`](./bgutil-provider): Railway/Docker wrapper for the BgUtils YouTube POT provider.

## Features

| Capability | Default behavior |
|---|---|
| Input | Paste a supported media URL into Telegram |
| Formats | Best, 1080p, 720p, 480p, and MP3 |
| Delivery | Video, audio, or document fallback |
| Queueing | Per-user concurrency protection with configurable global concurrency |
| Upload limit | Approximately 49 MB through the public Bot API; up to roughly 1.9 GB with a custom Bot API or MTProto configuration |
| Long media | Configurable duration limit; live streams and playlists are skipped by design |
| Authentication | Telegram Bot API identity; optional user allowlist |
| Hosting | Railway with Docker; local Docker or Node execution is also supported |
| Extraction | `yt-dlp` plus optional cookies and BgUtils POT provider |

## Architecture

```text
┌─────────────────────────────┐
│  User in Telegram           │
│  sends a URL + format       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  ReelDrop bot                │
│  Telegraf handlers           │
│  URL validation + queue      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  yt-dlp + ffmpeg             │
│  probe, download, remux,     │
│  compress, and format output │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌────────────────────┐
│ Telegram API │  │ Optional services  │
│ or MTProto   │  │ Bot API / POT      │
└──────────────┘  └────────────────────┘

┌─────────────────────────────┐
│ Vercel companion console    │
│ React + TanStack Start      │
│ docs, demo, deploy guide    │
└─────────────────────────────┘
```

## Quick start

### Prerequisites

- Node.js 20 or newer for the bot; Node.js 22 is used by the production Docker image.
- A Telegram bot token created with [@BotFather](https://t.me/BotFather).
- `yt-dlp` and `ffmpeg` available on `PATH` for a non-Docker local run.
- Docker, if you prefer to run the bot in the same environment as production.

### 1. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`.
3. Choose a display name and username.
4. Copy the token and keep it private.

### 2. Configure the bot

```bash
cd bot
cp env.example .env
```

At minimum, set:

```env
BOT_TOKEN=123456:replace-with-your-token
```

Do not commit `.env`, bot tokens, Telegram API hashes, session strings, cookies, or any other credentials.

### 3. Install and run

```bash
npm install
node --env-file=.env src/index.js
```

Or use the bot's package scripts:

```bash
npm start
```

Send `/start` to your bot, paste a supported URL, and choose a format.

## Deploy the bot to Railway

The recommended deployment is the [`bot/`](./bot) directory as its own Railway service.

### Deploy from this repository

1. Create a new Railway project.
2. Add a service from this GitHub repository.
3. Set the service root directory to `bot`.
4. Railway will use [`bot/Dockerfile`](./bot/Dockerfile) and [`bot/railway.toml`](./bot/railway.toml).
5. Add the required environment variables.
6. Deploy the service.
7. Open the bot in Telegram and send `/start`.

The production image includes Node.js, Python, `yt-dlp`, `ffmpeg`, and the optional BgUtils package. Allocate at least **1 GB RAM** if you expect frequent 1080p merges or large files.

### Webhook or long polling

Long polling is the default and requires no public URL. To use a webhook, generate a Railway domain and set:

```env
WEBHOOK_URL=https://your-service.up.railway.app
```

Leave `WEBHOOK_URL` empty to use long polling.

### Health checks

The bot service exposes health and Telegram webhook routes through its HTTP server. Configure Railway's health check path to match the route used by your deployment configuration, then confirm the service logs report a successful Telegram connection.

## Environment variables

The complete template is [`bot/env.example`](./bot/env.example). The most important variables are listed below.

### Required

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Token issued by @BotFather. Keep it secret. |

### Runtime and access control

| Variable | Default | Description |
|---|---:|---|
| `WEBHOOK_URL` | empty | Public HTTPS origin for webhook mode. Empty means long polling. |
| `ALLOWED_USER_IDS` | empty | Comma-separated Telegram user IDs. Empty means the bot is public. |
| `MAX_FILE_MB` | `49` | Maximum output size when using the public Bot API. |
| `MAX_DURATION_SEC` | `7800` | Maximum accepted media duration in seconds. |
| `CONCURRENCY` | `2` | Maximum simultaneous download jobs for the service. |
| `DOWNLOAD_TIMEOUT_MS` | `180000` | Download timeout in milliseconds. |

### Source access

| Variable | Description |
|---|---|
| `COOKIES_B64` | Base64-encoded Netscape `cookies.txt`, useful for sources requiring an authenticated browser session. |
| `COOKIES_FILE` | Path to a mounted Netscape cookies file. Use instead of `COOKIES_B64` when mounting secrets as files. |
| `BGUTIL_POT_URL` | URL of a BgUtils POT provider for improved YouTube reliability on hosted IPs. |

### Large-file and MTProto delivery

| Variable | Description |
|---|---|
| `TELEGRAM_API_ROOT` | Custom Telegram Bot API server URL. This can raise the upload ceiling substantially. |
| `TG_API_ID` | Telegram application API ID from [my.telegram.org](https://my.telegram.org). |
| `TG_API_HASH` | Telegram application API hash from [my.telegram.org](https://my.telegram.org). |
| `TG_SESSION` | Secret GramJS session string for MTProto uploads. Treat it like a password. |

> The exact behavior of optional MTProto settings is implemented in [`bot/src/gramjs-uploader.js`](./bot/src/gramjs-uploader.js) and the surrounding bot configuration. Keep all session material out of source control and logs.

## Optional large-file delivery

Telegram's public Bot API has a much smaller upload limit than a self-hosted local Bot API server. To support larger files, deploy the service in [`telegram-bot-api/`](./telegram-bot-api).

### Railway setup

1. Create a second Railway service from this repository.
2. Set its root directory to `telegram-bot-api`.
3. Add `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from [my.telegram.org](https://my.telegram.org).
4. Keep local mode enabled.
5. Generate a public domain, or use Railway private networking.
6. Set `TELEGRAM_API_ROOT` on the ReelDrop bot service to the resulting URL.
7. Set `MAX_FILE_MB` to an appropriate value, such as `1900`.
8. Redeploy the bot.

For the complete service-specific instructions, see [`telegram-bot-api/README.md`](./telegram-bot-api/README.md).

Example private-network configuration:

```env
TELEGRAM_API_ROOT=http://telegram-bot-api.railway.internal:8081
MAX_FILE_MB=1900
```

## Optional YouTube POT provider

Hosted datacenter IPs can encounter YouTube bot checks such as HTTP 403, HTTP 410, or “Sign in to confirm you're not a bot”. The [`bgutil-provider/`](./bgutil-provider) service packages the BgUtils POT provider for Railway or Docker deployment.

### Railway setup

1. Add a new service from this repository.
2. Set its root directory to `bgutil-provider`.
3. Deploy it.
4. Connect the bot using Railway private networking:

```env
BGUTIL_POT_URL=http://bgutil-provider.railway.internal:4416
```

See [`bgutil-provider/README.md`](./bgutil-provider/README.md) for the direct Docker-image deployment option and additional details.

## Run the bot locally

### Native Node run

Install `yt-dlp` and `ffmpeg` using your operating system's package manager, then:

```bash
cd bot
npm install
cp env.example .env
# Edit .env and set BOT_TOKEN
npm start
```

### Docker run

Build the production image:

```bash
cd bot
docker build -t reeldrop-bot .
```

Run it with an environment file:

```bash
docker run --rm --env-file .env -p 8080:8080 reeldrop-bot
```

The bot's Docker image is defined in [`bot/Dockerfile`](./bot/Dockerfile). For production, prefer a managed secret store or Railway Variables instead of copying secrets into an image or repository.

## Use the bot

| Command | Action |
|---|---|
| `/start` | Show the welcome message and reply keyboard |
| `/help` | Explain the workflow and supported actions |
| `/audio <url>` | Extract an audio track from a URL |
| `/id` | Show the current Telegram user ID |
| `/cancel` | Cancel the current download |

You can also paste a URL as a normal message. The bot probes the source, presents the available format card, downloads the selected format, and sends the result back to the chat.

### Supported format choices

- **Best**: best available combined result within the configured limits.
- **1080p**: high-quality video where the source provides it.
- **720p**: balanced quality and file size.
- **480p**: lower bandwidth and faster delivery.
- **MP3**: audio extraction.

Availability depends on the source, the extractor, authentication requirements, and the configured Telegram upload path.

## Web companion console

The web application lives at the repository root and is deployed separately from the Telegram worker. The current companion console is available at:

- <https://medialicker.vercel.app>

Run it locally:

```bash
npm install
npm run dev
```

The root app uses the repository's TanStack Start/Vite setup and is intended to run on port 8080 during development. Useful routes include:

- `/` — product landing page and interactive demo.
- `/deploy` — Railway deployment walkthrough.
- `/source` — source/deployment-related companion content.
- `/reeldrop-bot.zip` — downloadable bot bundle served from `public/`.

The demo simulates the chat flow in the browser. It does not send URLs to the bot and does not persist downloaded media.

## Project structure

```text
.
├── bot/                         # Deployable ReelDrop Telegram bot
│   ├── src/
│   │   ├── bot.js               # Telegraf commands and message handlers
│   │   ├── downloader.js         # Probe, download, and output-size workflow
│   │   ├── ffmpeg.js             # Remuxing and compression helpers
│   │   ├── gramjs-uploader.js    # Optional MTProto upload path
│   │   ├── queue.js              # Download concurrency control
│   │   ├── server.js             # Health and webhook HTTP server
│   │   ├── urls.js               # URL extraction and SSRF protections
│   │   └── ytdlp.js              # yt-dlp process execution
│   ├── Dockerfile
│   ├── env.example
│   ├── railway.toml
│   └── README.md
├── bgutil-provider/             # Optional YouTube POT provider service
├── telegram-bot-api/             # Optional self-hosted Telegram Bot API service
├── public/                      # Web assets and downloadable bot bundle
├── src/                         # TanStack Start companion console
│   ├── components/
│   ├── lib/
│   ├── routes/
│   └── styles.css
├── migrations/                   # Platform/auth migration assets
├── scripts/                      # Build, preview, migration, and QA tooling
├── package.json                  # Root web-app scripts and dependencies
└── vite.config.ts                # Root Vite/TanStack configuration
```

## Development and verification

From the repository root:

```bash
npm install
npm run dev
```

Before opening a pull request, run the available quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For the Telegram bot, validate its independent package as well:

```bash
cd bot
npm install
npm start
```

When changing deployment behavior, also review:

- [`bot/Dockerfile`](./bot/Dockerfile)
- [`bot/railway.toml`](./bot/railway.toml)
- [`telegram-bot-api/README.md`](./telegram-bot-api/README.md)
- [`bgutil-provider/README.md`](./bgutil-provider/README.md)

## Operational guidance

### Secrets

Never commit or print:

- `BOT_TOKEN`.
- `TELEGRAM_API_ID` or `TELEGRAM_API_HASH`.
- `TG_SESSION`.
- Cookies or cookie-derived values.
- Railway API tokens or deployment credentials.
- Database or auth credentials used by the companion application.

If a secret is accidentally exposed, revoke or rotate it immediately. In particular, rotate Telegram bot tokens with @BotFather and regenerate Telegram application credentials or sessions as appropriate.

### Resource sizing

Media extraction is CPU-, memory-, and bandwidth-intensive. For a production Railway deployment:

- Start with at least 1 GB RAM for 1080p merges.
- Keep `CONCURRENCY` conservative until you understand workload and source behavior.
- Set a duration and file-size ceiling.
- Monitor disk usage for temporary downloads.
- Prefer private networking for companion Railway services when possible.
- Use an allowlist for private deployments with `ALLOWED_USER_IDS`.

### Abuse and compliance

A public downloader bot can be abused quickly. Consider:

- Restricting access with `ALLOWED_USER_IDS`.
- Rate limiting or adding per-user quotas before public launch.
- Logging operational metadata without logging private media URLs or secrets.
- Reviewing the terms of service for every supported source.
- Providing a clear takedown/contact process if the bot is operated by a team.

## Troubleshooting

### The bot does not respond

- Confirm `BOT_TOKEN` is present and valid.
- Check that only one polling process is using the token.
- If using webhooks, confirm `WEBHOOK_URL` is a public HTTPS URL and that Railway health checks pass.
- Review the service logs for Telegram authentication or network errors.

### YouTube returns 403, 410, or a bot-check message

- Update `yt-dlp` in the container image.
- Deploy the optional BgUtils POT provider and set `BGUTIL_POT_URL`.
- For age-gated or authenticated sources, provide a valid `COOKIES_B64` or mounted `COOKIES_FILE`.
- Confirm that the selected format is available to the extractor.

### Files are too large for Telegram

- Use a lower format such as 720p or 480p.
- Increase `MAX_FILE_MB` only when using a compatible custom Bot API or MTProto path.
- Deploy [`telegram-bot-api/`](./telegram-bot-api) and configure `TELEGRAM_API_ROOT`.
- Make sure the service has enough temporary disk space and memory for the conversion.

### Instagram or other authenticated sources fail

- Export a fresh Netscape-format `cookies.txt` from an account you control.
- Base64-encode it and set `COOKIES_B64`, or mount it and set `COOKIES_FILE`.
- Never commit cookies or include them in issue reports.
- Be aware that source-side login challenges and account restrictions can still prevent extraction.

### The web console is blank after a change

- Run `npm run typecheck` and `npm run build` from the repository root.
- Check browser console errors and failed asset requests.
- Confirm that the root TanStack Start routes and Vite configuration were not replaced by a generic scaffold.
- Verify that the deployment serves the built output rather than a stale preview artifact.

## Contributing

1. Create a focused branch from `main`.
2. Keep bot, companion-console, and infrastructure changes isolated when possible.
3. Do not include secrets, cookies, downloaded media, or generated deployment artifacts in commits.
4. Update the relevant README when adding an environment variable or deployment service.
5. Run type checking, linting, tests, and a production build before opening a pull request.
6. Include reproduction steps and relevant sanitized logs for bug reports.

## License

No license file is currently published in this repository. Until a license is added, all rights are reserved by the repository owner and third-party dependencies remain under their respective licenses.

If you intend to accept external contributions or distribute the bot, add an explicit license and review the legal/compliance requirements for the media sources and Telegram integrations you support.

## Acknowledgements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for media extraction.
- [FFmpeg](https://ffmpeg.org/) for media processing.
- [Telegraf](https://github.com/telegraf/telegraf) for Telegram bot integration.
- [GramJS](https://gram.js.org/) for the optional MTProto upload path.
- [Railway](https://railway.app/) and [Vercel](https://vercel.com/) for deployment targets.
- [BgUtils POT Provider](https://github.com/brainicism/bgutil-ytdlp-pot-provider) for the optional YouTube Proof-of-Origin token service.
