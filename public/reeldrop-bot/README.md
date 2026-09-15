# ReelDrop

Telegram bot that pulls video or audio from almost any site via **yt-dlp** and sends the file back in chat. Built to run on **Railway** with Docker (Node 22 + ffmpeg + yt-dlp).

Send a link. Pick a format. Get the file.

## What it does

- YouTube, TikTok, Instagram, X, Reddit, Vimeo, Facebook, Twitch clips, and everything else yt-dlp supports
- Inline quality buttons: Best, 1080p, 720p, 480p, MP3
- Progress updates, then `sendVideo` / `sendAudio` (falls back to document)
- Compresses oversize files toward Telegram’s ~50 MB bot cap
- Optional private mode (`ALLOWED_USER_IDS`)
- Optional webhook (`WEBHOOK_URL`) or long polling
- Premium custom emoji on every message and keyboard button

Only download media you have the right to keep.

## Railway deploy

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. New Railway project → empty service, or push **this folder** as its own repo.
3. Railway will pick up `Dockerfile` + `railway.toml`.
4. Variables:

```
BOT_TOKEN=123456:your-token-here
MAX_FILE_MB=49
```

5. Generate a public domain. Optional webhook:

```
WEBHOOK_URL=https://your-service.up.railway.app
```

If `WEBHOOK_URL` is empty the bot polls. Both work on Railway. Leave at least **1 GB RAM** for 1080p merges.

6. Open the bot in Telegram, tap **Start**, paste a link.

### Cookies (Instagram / age-gated YouTube)

Export a Netscape `cookies.txt`, base64-encode it, set `COOKIES_B64`.

## Local

Needs `yt-dlp` and `ffmpeg` on PATH.

```bash
cp env.example .env   # then fill BOT_TOKEN
npm install
node --env-file=.env src/index.js
```

## Commands

| Command | Action |
|---|---|
| `/start` | Welcome + reply keyboard |
| `/help` | How it works |
| `/audio <url>` | Extract MP3 |
| `/id` | Your Telegram user id |
| `/cancel` | Kill the current download |

Paste a URL as a normal message to get the format card.

## Premium emoji

Messages use HTML `<tg-emoji emoji-id="…">`. Buttons set `icon_custom_emoji_id` (Bot API 9.4+). Telegram renders these when:

- the bot has a Fragment username, **or**
- the bot owner has Telegram Premium, and the message is a direct send (not forwarded through a channel)

Otherwise clients show the unicode fallback baked into each tag.

## Layout

```
src/index.js        boot, webhook vs polling, cookies
src/bot.js          Telegraf handlers
src/emoji.js        premium emoji catalog + button helpers
src/downloader.js   probe + yt-dlp + size guard
src/ytdlp.js        process spawn
src/ffmpeg.js       remux / compress to Telegram cap
src/urls.js         extract + SSRF block
src/queue.js        concurrency
src/server.js       /health + /telegram
Dockerfile          Node 22, python3, ffmpeg, yt-dlp
railway.toml        Docker builder + health check
```
