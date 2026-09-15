import http from "node:http";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { initGramJs } from "./gramjs-uploader.js";
import { log } from "./logger.js";
import { createServer } from "./server.js";

const config = loadConfig();

if (config.cookiesB64 && !config.cookiesFile) {
  const path = join(tmpdir(), "reeldrop-cookies.txt");
  let content;
  const raw = config.cookiesB64.trim();
  if (raw.includes("Netscape") || raw.includes("# HTTP Cookie") || raw.includes("\t")) {
    content = Buffer.from(raw, "utf8");
  } else {
    content = Buffer.from(raw.replace(/\s+/g, ""), "base64");
  }
  await writeFile(path, content);
  config.cookiesFile = path;
  const str = content.toString("utf8");
  const hasYt = str.includes("youtube.com") || str.includes(".google.com");
  log("info", "wrote cookies from COOKIES_B64", {
    bytes: content.length,
    hasYouTubeCookies: hasYt,
  });
}

// Initialise MTProto user client (optional — enables 2 GB uploads)
await initGramJs(config);

const bot = createBot(config);
bot.telegram.options.apiRoot = config.apiRoot;
bot.telegram.options.agent = config.apiRoot.startsWith("http://")
  ? new http.Agent({ keepAlive: true })
  : config.httpsAgent;
bot.telegram.options.webhookReply = false;

if (config.isLocalBotApi) {
  log("info", "using custom Telegram Bot API server", {
    apiRoot: config.apiRoot,
    maxFileMb: config.maxFileMb,
  });
}

const server = createServer({ config, bot });

server.listen(config.port, "0.0.0.0", () => {
  log("info", "health server listening", { port: config.port });
});

function explainTelegramError(err) {
  const res = err?.response;
  const msg = res?.message || res?.description || err?.message || "unknown";
  const code = res?.code || res?.error_code;
  if (msg === "Application not found" || res?.request_id) {
    if (config.isLocalBotApi) {
      return `404 from custom Bot API server at ${config.apiRoot}. Verify your telegram-bot-api Railway service is running and has a domain or internal URL configured.`;
    }
    return "This 404 is Railway's edge, not Telegram. BOT_TOKEN is invalid or the client is not calling https://api.telegram.org. Paste the token from @BotFather with no quotes, no bot prefix, no semicolon. BOT_TOKEN must not be a Railway URL.";
  }
  if (code === 401 || /unauthorized/i.test(String(msg))) {
    return "Telegram rejected the token (401). It was revoked or mistyped. @BotFather -> API Token -> Revoke -> paste the new one.";
  }
  if (code === 404 || /not found/i.test(String(msg))) {
    return "Telegram 404 Not Found. BOT_TOKEN is wrong (extra quotes, a bot prefix, a newline, or a deleted bot). Copy it again from @BotFather.";
  }
  return String(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getMeRetry(maxAttempts = 10) {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const me = await bot.telegram.getMe();
      log("info", "telegram ok", { username: me.username, id: me.id });
      return me;
    } catch (err) {
      last = err;
      log("error", "telegram getMe failed", {
        attempt,
        detail: explainTelegramError(err),
      });
      await sleep(Math.min(20_000, 1500 * 2 ** (attempt - 1)));
    }
  }
  throw last;
}

async function startTelegram() {
  const me = await getMeRetry();

  try {
    await bot.telegram.setMyCommands([
      { command: "start", description: "Start ReelDrop" },
      { command: "help", description: "How it works" },
      { command: "audio", description: "Extract MP3 from a link" },
      { command: "id", description: "Show your Telegram id" },
      { command: "cancel", description: "Stop the current download" },
    ]);
  } catch (err) {
    log("error", "setMyCommands skipped - bot still runs", {
      detail: explainTelegramError(err),
    });
  }

  if (config.webhookUrl) {
    const hook = `${config.webhookUrl.replace(/\/$/, "")}/telegram`;
    await bot.telegram.setWebhook(hook);
    log("info", "webhook mode", { hook, username: me.username });
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    bot.launch({ dropPendingUpdates: true });
    log("info", "polling mode", { username: me.username });
  }
}

startTelegram().catch((err) => {
  log("error", "telegram still unreachable - process stays up for health checks", {
    detail: explainTelegramError(err),
  });
  const retry = async () => {
    try {
      await startTelegram();
    } catch {
      setTimeout(retry, 30_000).unref();
    }
  };
  setTimeout(retry, 30_000).unref();
});

function shutdown(signal) {
  log("info", "shutdown", { signal });
  try {
    bot.stop(signal);
  } catch {
    /* not launched */
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
