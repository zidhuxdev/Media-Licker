function num(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function list(name) {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig() {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "BOT_TOKEN is missing. Create a bot with @BotFather and set BOT_TOKEN on Railway.",
    );
  }

  const port = num("PORT", 3000);
  const webhookUrl = (process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN || "")
    .trim()
    .replace(/\/$/, "");
  const webhook =
    webhookUrl.length === 0
      ? ""
      : webhookUrl.startsWith("http")
        ? webhookUrl
        : `https://${webhookUrl}`;

  return {
    token,
    port,
    webhookUrl: webhook,
    allowedUserIds: list("ALLOWED_USER_IDS").map((id) => String(id)),
    maxFileMb: num("MAX_FILE_MB", 49),
    maxDurationSec: num("MAX_DURATION_SEC", 1800),
    concurrency: Math.max(1, num("CONCURRENCY", 2)),
    downloadTimeoutMs: num("DOWNLOAD_TIMEOUT_MS", 180_000),
    ytdlpPath: process.env.YTDLP_PATH?.trim() || "yt-dlp",
    ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg",
    cookiesFile: process.env.COOKIES_FILE?.trim() || "",
    cookiesB64: process.env.COOKIES_B64?.trim() || "",
    extraYtdlpArgs: process.env.EXTRA_YTDLP_ARGS?.trim() || "",
    userAgent:
      process.env.USER_AGENT?.trim() ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
}
