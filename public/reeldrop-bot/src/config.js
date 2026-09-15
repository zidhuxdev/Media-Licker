import dns from "node:dns";
import https from "node:https";

dns.setDefaultResultOrder("ipv4first");

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

/** Strip quotes, trailing semicolons, and a leading "bot" prefix. */
export function sanitizeToken(raw) {
  let t = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  t = t.replace(/^['"`]+|['"`]+$/g, "").trim();
  t = t.replace(/[;\s]+$/g, "").trim();
  t = t.replace(/^bot/i, "").trim();
  t = t.replace(/\s+/g, "");
  return t;
}

const TOKEN_RE = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;

export function loadConfig() {
  const token = sanitizeToken(process.env.BOT_TOKEN);
  if (!token) {
    throw new Error(
      "BOT_TOKEN is missing. Create a bot with @BotFather, send /token, and paste it on Railway with no quotes.",
    );
  }
  if (!TOKEN_RE.test(token)) {
    const hint = token.includes(":") ? token.split(":")[0] : token.slice(0, 8);
    throw new Error(
      `BOT_TOKEN is not a Telegram bot token (id prefix "${hint}", ${token.length} chars). It must look like 123456789:AAH.... No quotes, no \"bot\" prefix, no semicolon, not a Railway URL. @BotFather -> your bot -> API Token.`,
    );
  }

  const port = num("PORT", 3000);
  const webhookUrl = (process.env.WEBHOOK_URL || process.env.RAILWAY_PUBLIC_DOMAIN || "")
    .trim()
    .replace(/[;\s]+$/g, "")
    .replace(/\/$/, "");
  const webhook =
    webhookUrl.length === 0
      ? ""
      : webhookUrl.startsWith("http")
        ? webhookUrl
        : `https://${webhookUrl}`;

  const apiRoot = (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org")
    .trim()
    .replace(/\/$/, "");

  let bgutilPotUrl = (process.env.BGUTIL_POT_URL || "").trim();
  if (bgutilPotUrl === "true" || bgutilPotUrl === "1") {
    bgutilPotUrl = "http://127.0.0.1:4416";
  } else if (bgutilPotUrl && !bgutilPotUrl.startsWith("http://") && !bgutilPotUrl.startsWith("https://")) {
    bgutilPotUrl = `http://${bgutilPotUrl}`;
  }
  bgutilPotUrl = bgutilPotUrl.replace(/\/+$/, "");

  const hasMtProto = Boolean(
    process.env.TG_API_ID && process.env.TG_API_HASH && process.env.TG_SESSION,
  );

  return {
    token,
    port,
    webhookUrl: webhook,
    apiRoot,
    isLocalBotApi,
    bgutilPotUrl,
    httpsAgent: new https.Agent({ family: 4, keepAlive: true }),
    allowedUserIds: list("ALLOWED_USER_IDS").map((id) => String(id)),
    // If Custom Bot API or MTProto is active, default upload limit to 1900 MB (~2 GB limit)
    // otherwise stay at standard Bot API 49 MB limit. Always overrideable via MAX_FILE_MB.
    maxFileMb: num("MAX_FILE_MB", isLocalBotApi || hasMtProto ? 1900 : 49),
    maxDurationSec: num("MAX_DURATION_SEC", 1800),
    concurrency: Math.max(1, num("CONCURRENCY", 2)),
    downloadTimeoutMs: num("DOWNLOAD_TIMEOUT_MS", 180_000),
    ytdlpPath: process.env.YTDLP_PATH?.trim() || "yt-dlp",
    ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg",
    ffprobePath: process.env.FFPROBE_PATH?.trim() || "ffprobe",
    cookiesFile: process.env.COOKIES_FILE?.trim() || "",
    cookiesB64: process.env.COOKIES_B64?.trim() || "",
    extraYtdlpArgs: process.env.EXTRA_YTDLP_ARGS?.trim() || "",
    // MTProto / GramJS user-client credentials for 2 GB uploads
    tgApiId: process.env.TG_API_ID?.trim() || "",
    tgApiHash: process.env.TG_API_HASH?.trim() || "",
    tgSession: process.env.TG_SESSION?.trim() || "",
    tgSessionFile: process.env.TG_SESSION_FILE?.trim() || "",
    userAgent: process.env.USER_AGENT?.trim() || "",
  };
}
