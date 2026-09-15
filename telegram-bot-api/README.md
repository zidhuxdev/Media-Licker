# Telegram Bot API Server on Railway

Run your own Telegram Bot API server on Railway to unlock up to **2 GB file uploads** and bypass Telegram's standard 50 MB bot limits.

---

## 1. Deploy on Railway

### Option A: Deploy from Docker Image (Quickest)
1. Open your **Railway Project**.
2. Click **+ New Service** → **Docker Image**.
3. Image name: `aiogram/telegram-bot-api:latest`
4. In the service **Variables** tab, add:
   - `TELEGRAM_API_ID` (your Telegram API ID from [my.telegram.org](https://my.telegram.org))
   - `TELEGRAM_API_HASH` (your Telegram API Hash from [my.telegram.org](https://my.telegram.org))
   - `TELEGRAM_LOCAL=1`
   - `TELEGRAM_STAT=1`
   - `PORT=8081`
5. In **Settings** → **Networking**:
   - Click **Generate Domain** (e.g. `https://telegram-bot-api-production.up.railway.app`)
   - OR use Railway Private Networking: `http://telegram-bot-api.railway.internal:8081`

### Option B: Deploy from this Git Repository
1. In Railway, click **+ New Service** → **GitHub Repo** (select this repository).
2. In **Settings** → **Source** → **Root Directory**: set to `/telegram-bot-api`.
3. In **Variables**, add `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`.
4. In **Settings** → **Networking**, click **Generate Domain**.

---

## 2. Connect to Media Licker Bot

1. Open your **Media Licker bot** service on Railway.
2. Go to the **Variables** tab and set:
   - `TELEGRAM_API_ROOT`: the URL of your `telegram-bot-api` service
     - Example: `https://telegram-bot-api-production.up.railway.app`
     - Or (internal): `http://telegram-bot-api.railway.internal:8081`
   - `MAX_FILE_MB`: `1900` (or leave default — it auto-detects up to 2 GB)
3. Redeploy your bot.

---

## 3. Verify
In your bot logs, you will see:
```text
info using custom Telegram Bot API server { apiRoot: 'https://...', maxFileMb: 1900 }
info telegram ok { username: 'your_bot', id: ... }
```
When you send `/start` to the bot, it will confirm:
`Upload limit: ~1.9 GB via Custom Bot API Server`
