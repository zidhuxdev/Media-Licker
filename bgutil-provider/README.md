# BgUtils POT Provider for YouTube

This directory allows you to deploy the **BgUtils PO Token (POT) Provider** (`brainicism/bgutil-ytdlp-pot-provider`) as a service on **Railway** (or Docker).

It eliminates YouTube bot checks ("Sign in to confirm you're not a bot", HTTP 403 Forbidden, HTTP 410 Gone) by generating real Google Proof-of-Origin (PO) tokens on demand for `yt-dlp`.

---

## 🚀 How to Deploy on Railway

You have two easy methods:

### Method 1: Deploy Directly via Docker Image (Easiest — 30 seconds)
1. In your **Railway Project**, click **+ New** (top right).
2. Select **Docker Image**.
3. Type: `brainicism/bgutil-ytdlp-pot-provider` and press Enter.
4. Click on the created service -> **Settings** -> rename it to `bgutil-provider`.
5. Railway provides automatic private networking between services inside the same project.
   The internal URL is:
   ```text
   http://bgutil-provider.railway.internal:4416
   ```

### Method 2: Deploy from this Repository
1. In your Railway Project, click **+ New** -> **GitHub Repo** -> select your repo.
2. In the service **Settings**:
   - **Root Directory**: `bgutil-provider`
   - **Watch Paths**: `bgutil-provider/**`
3. Click **Deploy**.

---

## 🔗 Connect it to your ReelDrop Telegram Bot

1. Open your **ReelDrop Bot** service in Railway.
2. Go to **Variables**.
3. Add:
   ```env
   BGUTIL_POT_URL=http://bgutil-provider.railway.internal:4416
   ```
4. Redeploy the bot.

`yt-dlp` will now automatically fetch valid PO tokens from the provider service whenever downloading YouTube videos, unlocking full formats and bypassing bot detection!
