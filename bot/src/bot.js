import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { Telegraf } from "telegraf";
import { cleanupDir, downloadMedia, formatDuration, probe } from "./downloader.js";
import { E, PARSE_HTML, iconButton, iconKb, pe } from "./emoji.js";
import { gramJsReady, gramJsSend } from "./gramjs-uploader.js";
import { log } from "./logger.js";
import { createQueue } from "./queue.js";
import { assertSafeUrl, extractUrl } from "./urls.js";

const jobs = new Map();
const userBusy = new Set();
const userAbort = new Map();

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function jobId() {
  return randomBytes(4).toString("hex");
}

function rememberJob(data) {
  const id = jobId();
  jobs.set(id, { ...data, createdAt: Date.now() });
  if (jobs.size > 400) {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [key, job] of jobs) {
      if (job.createdAt < cutoff) jobs.delete(key);
    }
  }
  return id;
}

function mainKeyboard() {
  return {
    keyboard: [
      [iconKb("Help", "help"), iconKb("Audio", "audio", "success")],
      [iconKb("My ID", "user")],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function qualityKeyboard(id, sizes = {}) {
  const bestLabel = sizes.best ? `Best · ${sizes.best}` : "Best";
  const p1080Label = sizes["1080"] ? `1080p · ${sizes["1080"]}` : "1080p";
  const p720Label = sizes["720"] ? `720p · ${sizes["720"]}` : "720p";
  const p480Label = sizes["480"] ? `480p · ${sizes["480"]}` : "480p";
  const audioLabel = sizes.audio ? `MP3 · ${sizes.audio}` : "MP3 audio";

  return {
    inline_keyboard: [
      [
        iconButton(bestLabel, `q:${id}:best`, "fire", "primary"),
        iconButton(p1080Label, `q:${id}:1080`, "hd", "primary"),
      ],
      [
        iconButton(p720Label, `q:${id}:720`, "p720"),
        iconButton(p480Label, `q:${id}:480`, "p480"),
      ],
      [
        iconButton(audioLabel, `q:${id}:audio`, "audio", "success"),
        iconButton("Cancel", `x:${id}`, "cancel", "danger"),
      ],
    ],
  };
}

function welcomeHtml(config) {
  const limitLabel = config?.isLocalBotApi
    ? `Upload limit: ~${Math.round((config.maxFileMb || 1900) / 1000 * 10) / 10} GB via Custom Bot API Server`
    : gramJsReady()
      ? "Upload limit: ~2 GB via MTProto"
      : "Telegram bots cap uploads at ~50 MB. Pick 720p or 480p for long clips.";
  return [
    `${pe("spark")} <b>ReelDrop</b>`,
    "",
    `${pe("link")} Send a video link from YouTube, TikTok, Instagram, X, Reddit, Vimeo, Facebook — or almost any other site yt-dlp knows.`,
    "",
    `${pe("download")} I'll fetch the file and send it back in this chat.`,
    "",
    `${pe("info")} <b>Commands</b>`,
    `${pe("plus")} /audio — extract MP3`,
    `${pe("user")} /id — your Telegram id`,
    `${pe("stop")} /cancel — stop the current job`,
    `${pe("help")} /help — this message`,
    "",
    `${pe("lock")} ${limitLabel}`,
  ].join("\n");
}

function helpHtml() {
  return [
    `${pe("help")} <b>How it works</b>`,
    "",
    `${pe("link")} Paste a link. That's it.`,
    `${pe("film")} Then pick Best / 1080p / 720p / 480p / MP3.`,
    `${pe("clock")} Default cap is 30 minutes. Live streams and playlists are skipped.`,
    `${pe("file")} One download at a time per person.`,
    "",
    `${pe("mic")} Audio-only: send /audio followed by the link, or tap MP3 on the format card.`,
  ].join("\n");
}

function infoCard(info) {
  const lines = [
    `${pe("quote")} <b>${esc(info.title)}</b>`,
    `${pe("clock")} ${esc(formatDuration(info.duration))}`,
    `${pe("internet")} ${esc(info.extractor)}`,
  ];
  const sizes = info.sizes || {};
  const entries = [];
  if (sizes.best) entries.push(`Best: ${sizes.best}`);
  if (sizes["1080"]) entries.push(`1080p: ${sizes["1080"]}`);
  if (sizes["720"]) entries.push(`720p: ${sizes["720"]}`);
  if (sizes["480"]) entries.push(`480p: ${sizes["480"]}`);
  if (sizes.audio) entries.push(`MP3: ${sizes.audio}`);
  if (entries.length > 0) {
    lines.push(`${pe("file")} ${entries.map((e) => `<b>${esc(e)}</b>`).join(" · ")}`);
  }
  lines.push("");
  lines.push(`${pe("target")} Pick a format`);
  return lines.join("\n");
}

export function createBot(config) {
  const bot = new Telegraf(config.token);
  const enqueue = createQueue(config.concurrency);

  function gated(ctx) {
    if (!config.allowedUserIds.length) return true;
    const id = String(ctx.from?.id ?? "");
    return config.allowedUserIds.includes(id);
  }

  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    if (gated(ctx)) return next();
    await ctx.reply(
      `${pe("lock")} This bot is private. Your id is <code>${ctx.from.id}</code>`,
      PARSE_HTML,
    );
  });

  bot.start(async (ctx) => {
    await ctx.reply(welcomeHtml(config), { ...PARSE_HTML, reply_markup: mainKeyboard() });
  });

  bot.help(async (ctx) => {
    await ctx.reply(helpHtml(), PARSE_HTML);
  });

  bot.command("id", async (ctx) => {
    await ctx.reply(
      `${pe("user")} Your Telegram id is <code>${ctx.from.id}</code>`,
      PARSE_HTML,
    );
  });

  bot.command("cancel", async (ctx) => {
    const ac = userAbort.get(ctx.from.id);
    if (!ac) {
      await ctx.reply(`${pe("info")} Nothing is running.`, PARSE_HTML);
      return;
    }
    ac.abort();
    await ctx.reply(`${pe("stop")} Stopping that job.`, PARSE_HTML);
  });

  bot.command("audio", async (ctx) => {
    const url = extractUrl(ctx.message?.text || "");
    if (!url) {
      await ctx.reply(
        `${pe("mic")} Send <code>/audio</code> plus a link, or paste a link and tap MP3.`,
        PARSE_HTML,
      );
      return;
    }
    await handleIncoming(ctx, url, "audio");
  });

  bot.hears(/^Help$/i, (ctx) => ctx.reply(helpHtml(), PARSE_HTML));
  bot.hears(/^My ID$/i, (ctx) =>
    ctx.reply(`${pe("user")} Your Telegram id is <code>${ctx.from.id}</code>`, PARSE_HTML),
  );
  bot.hears(/^Audio$/i, (ctx) =>
    ctx.reply(
      `${pe("mic")} Send a link next, or <code>/audio https://…</code>`,
      PARSE_HTML,
    ),
  );

  bot.on("text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const url = extractUrl(ctx.message.text);
    if (!url) {
      if (ctx.chat.type !== "private") return;
      await ctx.reply(
        `${pe("link")} I need an http(s) video link.\n${pe("help")} Tap Help if you're stuck.`,
        PARSE_HTML,
      );
      return;
    }
    await handleIncoming(ctx, url);
  });

  async function handleIncoming(ctx, url, forcedQuality) {
    if (userBusy.has(ctx.from.id)) {
      await ctx.reply(
        `${pe("wait")} Already working on a file for you. Send /cancel to stop it.`,
        PARSE_HTML,
      );
      return;
    }

    let href;
    try {
      href = await assertSafeUrl(url);
    } catch (err) {
      await ctx.reply(`${pe("warn")} ${esc(err.message)}`, PARSE_HTML);
      return;
    }

    const status = await ctx.reply(`${pe("wait")} Reading the link…`, PARSE_HTML);

    try {
      const info = await probe(config, href);
      if (forcedQuality) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          status.message_id,
          undefined,
          `${pe("quote")} <b>${esc(info.title)}</b>\n${pe("mic")} Extracting audio…`,
          PARSE_HTML,
        );
        await runDownload(ctx, {
          url: href,
          quality: forcedQuality,
          info,
          statusId: status.message_id,
        });
        return;
      }

      const id = rememberJob({
        url: href,
        info,
        userId: ctx.from.id,
        chatId: ctx.chat.id,
      });

      const caption = infoCard(info);
      try {
        if (info.thumbnail && /^https?:/i.test(info.thumbnail)) {
          await ctx.telegram.deleteMessage(ctx.chat.id, status.message_id).catch(() => {});
          await ctx.replyWithPhoto(info.thumbnail, {
            caption,
            ...PARSE_HTML,
            reply_markup: qualityKeyboard(id, info.sizes),
          });
          return;
        }
      } catch {
        /* fall through to text card */
      }

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        status.message_id,
        undefined,
        caption,
        { ...PARSE_HTML, reply_markup: qualityKeyboard(id, info.sizes) },
      );
    } catch (err) {
      log("error", "probe failed", { err: err.message });
      await ctx.telegram
        .editMessageText(
          ctx.chat.id,
          status.message_id,
          undefined,
          `${pe("warn")} ${esc(cleanError(err))}`,
          PARSE_HTML,
        )
        .catch(async () => {
          await ctx.reply(`${pe("warn")} ${esc(cleanError(err))}`, PARSE_HTML);
        });
    }
  }

  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    if (data.startsWith("x:")) {
      await ctx.answerCbQuery("Cancelled");
      const id = data.slice(2);
      jobs.delete(id);
      await ctx.editMessageReplyMarkup().catch(() => {});
      await ctx.reply(`${pe("cancel")} Cancelled.`, PARSE_HTML);
      return;
    }
    if (!data.startsWith("q:")) {
      await ctx.answerCbQuery();
      return;
    }
    const parts = data.split(":");
    const id = parts[1];
    const quality = parts[2];
    const job = jobs.get(id);
    if (!job) {
      await ctx.answerCbQuery("That card expired. Send the link again.");
      return;
    }
    if (job.userId !== ctx.from.id) {
      await ctx.answerCbQuery("This card isn't yours.");
      return;
    }
    jobs.delete(id);
    await ctx.answerCbQuery("Downloading");
    await ctx.editMessageReplyMarkup().catch(() => {});

    const status = await ctx.reply(
      `${pe("download")} Starting ${esc(qualityLabel(quality))}…`,
      PARSE_HTML,
    );
    await runDownload(ctx, {
      url: job.url,
      quality,
      info: job.info,
      statusId: status.message_id,
    });
  });

  async function runDownload(ctx, { url, quality, info, statusId }) {
    if (userBusy.has(ctx.from.id)) {
      await ctx.reply(`${pe("wait")} Already working on a file for you.`, PARSE_HTML);
      return;
    }
    userBusy.add(ctx.from.id);
    const ac = new AbortController();
    userAbort.set(ctx.from.id, ac);

    let lastEdit = 0;
    const bump = async (html) => {
      const now = Date.now();
      if (now - lastEdit < 2500) return;
      lastEdit = now;
      await ctx.telegram
        .editMessageText(ctx.chat.id, statusId, undefined, html, PARSE_HTML)
        .catch(() => {});
    };

    // Track temp dir separately so the finally block can always delete it,
    // even if downloadMedia itself throws before returning the file object.
    let tempDir = null;

    try {
      const file = await enqueue(() =>
        downloadMedia(config, {
          url,
          quality,
          signal: ac.signal,
          isMtProto: gramJsReady(),
          isLocalBotApi: config.isLocalBotApi,
          onProgress: (pct) => {
            bump(
              `${pe("download")} ${esc(info.title)}\n${pe("percent")} ${pct}% · ${esc(qualityLabel(quality))}`,
            );
          },
        }),
      );

      // Capture dir as soon as we have a file — finally will clean it up
      tempDir = file.dir;

      await ctx.telegram
        .editMessageText(
          ctx.chat.id,
          statusId,
          undefined,
          `${pe("pack")} Uploading to Telegram…`,
          PARSE_HTML,
        )
        .catch(() => {});

      const caption = `${pe("check")} <b>${esc(info.title)}</b>\n${pe("tag")} ${esc(qualityLabel(quality))} · ${esc(formatSize(file.size))}`;

      // ── MTProto path (GramJS) — up to 2 GB ───────────────────────────────
      if (gramJsReady()) {
        try {
          await gramJsSend({
            filePath: file.path,
            chatId: ctx.chat.id,
            caption,
            kind: file.kind,
            meta: {
              title: info.title,
              width: info.width || 0,
              height: info.height || 0,
              duration: info.duration || 0,
            },
            onProgress: (pct) => bump(`${pe("pack")} Uploading… ${pct}%`),
          });
          await ctx.telegram.deleteMessage(ctx.chat.id, statusId).catch(() => {});
          return; // finally block still runs → file deleted
        } catch (uploadErr) {
          log("error", "gramjs upload failed — falling back to Bot API", {
            err: uploadErr.message,
          });
          // fall through to Bot API path
        }
      }

      // ── Bot API path — 50 MB cap ──────────────────────────────────────────
      const source = { source: createReadStream(file.path) };

      try {
        if (file.kind === "audio") {
          await ctx.replyWithAudio(source, {
            caption,
            ...PARSE_HTML,
            title: info.title,
          });
        } else {
          await ctx.replyWithVideo(source, {
            caption,
            ...PARSE_HTML,
            supports_streaming: true,
            width: info.width || undefined,
            height: info.height || undefined,
            duration: info.duration || undefined,
          });
        }
      } catch {
        await ctx.replyWithDocument(
          { source: createReadStream(file.path), filename: filenameFor(info.title, file.ext) },
          { caption, ...PARSE_HTML },
        );
      }

      await ctx.telegram.deleteMessage(ctx.chat.id, statusId).catch(() => {});
    } catch (err) {
      log("error", "download failed", { err: err.message, user: ctx.from.id });
      await ctx.telegram
        .editMessageText(
          ctx.chat.id,
          statusId,
          undefined,
          `${pe("warn")} ${esc(cleanError(err))}`,
          PARSE_HTML,
        )
        .catch(async () => {
          await ctx.reply(`${pe("warn")} ${esc(cleanError(err))}`, PARSE_HTML);
        });
    } finally {
      // Always delete the temp dir — success, upload error, download error, cancel
      if (tempDir) {
        await cleanupDir(tempDir);
        log("info", "temp dir deleted", { dir: tempDir });
      }
      userBusy.delete(ctx.from.id);
      userAbort.delete(ctx.from.id);
    }
  }

  bot.catch((err) => {
    log("error", "bot catch", { err: err.message });
  });

  return bot;
}

function qualityLabel(q) {
  if (q === "audio") return "MP3";
  if (q === "best") return "Best";
  return `${q}p`;
}

function formatSize(bytes) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function filenameFor(title, ext) {
  const base = title.replace(/[^\w.\-]+/g, "_").slice(0, 60) || "media";
  return `${base}.${ext}`;
}

function cleanError(err) {
  const msg = String(err.message || err);
  if (/Cancelled/i.test(msg)) return "Cancelled.";
  if (/timed out/i.test(msg)) return "That took too long. Try 480p or a shorter clip.";
  if (/Unsupported URL|No video/i.test(msg)) return "yt-dlp doesn't know that site or there's no video there.";
  if (/confirm you'?re not a bot|bot detection/i.test(msg))
    return "YouTube bot check triggered by datacenter IP. A fresh cookies.txt (COOKIES_B64) with YouTube cookies helps.";
  if (/Private video/i.test(msg))
    return "This video is private. A cookies.txt (COOKIES_B64) from an account with access is required.";
  if (/Sign in|login/i.test(msg))
    return "This video is login-gated or requires sign-in. A cookies.txt (COOKIES_B64) may help.";
  if (/age/i.test(msg)) return "Age-gated. Set COOKIES_B64 from a logged-in browser.";
  return msg.slice(0, 400);
}

export { E };
