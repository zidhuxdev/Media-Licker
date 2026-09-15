import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createServer } from "./server.js";

const config = loadConfig();

if (config.cookiesB64 && !config.cookiesFile) {
  const path = join(tmpdir(), "reeldrop-cookies.txt");
  await writeFile(path, Buffer.from(config.cookiesB64, "base64"));
  config.cookiesFile = path;
  log("info", "wrote cookies from COOKIES_B64");
}

const bot = createBot(config);
const server = createServer({ config, bot });

server.listen(config.port, "0.0.0.0", () => {
  log("info", `health server listening`, { port: config.port });
});

await bot.telegram.setMyCommands([
  { command: "start", description: "Start ReelDrop" },
  { command: "help", description: "How it works" },
  { command: "audio", description: "Extract MP3 from a link" },
  { command: "id", description: "Show your Telegram id" },
  { command: "cancel", description: "Stop the current download" },
]);

if (config.webhookUrl) {
  const hook = `${config.webhookUrl}/telegram`;
  await bot.telegram.setWebhook(hook);
  log("info", "webhook mode", { hook });
} else {
  await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  bot.launch({ dropPendingUpdates: true });
  log("info", "polling mode");
}

function shutdown(signal) {
  log("info", "shutdown", { signal });
  bot.stop(signal);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
