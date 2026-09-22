import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { Telegraf } from "telegraf";
import { cleanupDir, downloadMedia, formatDuration, probe } from "./downloader.js";
import { E, PARSE_HTML, iconButton, iconKb, pe } from "./emoji.js";
import { gramJsReady, gramJsSend } from "./gramjs-uploader.js";
import { log } from "./logger.js";
import { createQueue } from "./queue.js";
import { assertSafeUrl, extractUrl } from "./urls.js";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/** Format-card jobs (awaiting quality pick). Keyed by random hex id. */
const jobs = new Map();

/**
 * Per-user download queue.
 * userQueues.get(userId) = {
 *   active: boolean,            // true while a download is running
 *   ac: AbortController|null,  // abort handle for the ACTIVE job
 *   items: Array<{             // pending items (not yet started)
 *     url, quality, info,       // download params
 *     chatId,                   // where to send the result
 *     statusId,                 // message id of the "queued" status msg
 *   }>
 * }
 */
const userQueues = new Map();

// Max queued items per user (spam guard)
const MAX_QUEUE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  // GC old format-card jobs (> 30 min)
  if (jobs.size > 400) {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [key, job] of jobs) {
      if (job.createdAt < cutoff) jobs.delete(key);
    }
  }
  return id;
}

function getOrCreateUserQueue(userId) {
  if (!userQueues.has(userId)) {
    userQueues.set(userId, { active: false, ac: null, items: [] });
  }
  return userQueues.get(userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI builders
// ─────────────────────────────────────────────────────────────────────────────

function mainKeyboard() {
  return {
    keyboard: [
      [iconKb("Help", "help"), iconKb("Audio", "audio", "success")],
      [iconKb("Queue", "list"), iconKb("My ID", "user")],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function qualityKeyboard(id, sizes = {}) {
  const bestLabel  = sizes.best      ? `Best · ${sizes.best}`     : "Best";
  const p1080Label = sizes["1080"]   ? `1080p · ${sizes["1080"]}` : "1080p";
  const p720Label  = sizes["720"]    ? `720p · ${sizes["720"]}`   : "720p";
  const p480Label  = sizes["480"]    ? `480p · ${sizes["480"]}`   : "480p";
  const audioLabel = sizes.audio     ? `MP3 · ${sizes.audio}`     : "MP3 audio";

  return {
    inline_keyboard: [
      [
        iconButton(bestLabel,  `q:${id}:best`,  "fire",  "primary"),
        iconButton(p1080Label, `q:${id}:1080`,  "hd",    "primary"),
      ],
      [
        iconButton(p720Label,  `q:${id}:720`,  "p720"),
        iconButton(p480Label,  `q:${id}:480`,  "p480"),
      ],
      [
        iconButton(audioLabel, `q:${id}:audio`, "audio", "success"),
        iconButton("Cancel",   `x:${id}`,       "cancel","danger"),
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
    `${pe("stop")} /cancel — stop current job + clear queue`,
    `${pe("list")} /queue — show your pending queue`,
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
    `${pe("file")} Downloads run one at a time per user — extras are queued automatically.`,
    "",
    `${pe("list")} Send multiple links and they queue up in order.`,
    `${pe("stop")} /cancel stops the current download AND clears your queue.`,
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
  if (sizes.best)    entries.push(`Best: ${sizes.best}`);
  if (sizes["1080"]) entries.push(`1080p: ${sizes["1080"]}`);
  if (sizes["720"])  entries.push(`720p: ${sizes["720"]}`);
  if (sizes["480"])  entries.push(`480p: ${sizes["480"]}`);
  if (sizes.audio)   entries.push(`MP3: ${sizes.audio}`);
  if (entries.length > 0) {
    lines.push(`${pe("file")} ${entries.map((e) => `<b>${esc(e)}</b>`).join(" · ")}`);
  }
  lines.push("");
  lines.push(`${pe("target")} Pick a format`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot factory
// ─────────────────────────────────────────────────────────────────────────────

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

  // /cancel — abort current download AND drain the whole queue
  bot.command("cancel", async (ctx) => {
    const q = userQueues.get(ctx.from.id);
    if (!q || (!q.active && q.items.length === 0)) {
      await ctx.reply(`${pe("info")} Nothing to cancel.`, PARSE_HTML);
      return;
    }
    // Abort the running job (if any)
    if (q.ac) q.ac.abort();
    // Drain pending queue
    const drained = q.items.length;
    q.items = [];
    const msg = drained > 0
      ? `${pe("stop")} Stopped. Also removed ${drained} queued item${drained === 1 ? "" : "s"}.`
      : `${pe("stop")} Stopping that job.`;
    await ctx.reply(msg, PARSE_HTML);
  });

  // /queue — show pending items
  bot.command("queue", async (ctx) => {
    const q = userQueues.get(ctx.from.id);
    const pending = q?.items ?? [];
    if (!q?.active && pending.length === 0) {
      await ctx.reply(`${pe("list")} Your queue is empty.`, PARSE_HTML);
      return;
    }
    const lines = [];
    if (q.active) lines.push(`${pe("download")} <b>Downloading now…</b>`);
    pending.forEach((item, i) => {
      lines.push(`${pe("clock")} ${i + 1}. <b>${esc(item.info?.title || item.url)}</b> · ${esc(qualityLabel(item.quality))}`);
    });
    lines.push("");
    lines.push(`${pe("stop")} /cancel to stop everything`);
    await ctx.reply(lines.join("\n"), PARSE_HTML);
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
  bot.hears(/^Queue$/i, async (ctx) => {
    // reuse the /queue handler logic
    const q = userQueues.get(ctx.from.id);
    const pending = q?.items ?? [];
    if (!q?.active && pending.length === 0) {
      await ctx.reply(`${pe("list")} Your queue is empty.`, PARSE_HTML);
      return;
    }
    const lines = [];
    if (q.active) lines.push(`${pe("download")} <b>Downloading now…</b>`);
    pending.forEach((item, i) => {
      lines.push(`${pe("clock")} ${i + 1}. <b>${esc(item.info?.title || item.url)}</b> · ${esc(qualityLabel(item.quality))}`);
    });
    await ctx.reply(lines.join("\n"), PARSE_HTML);
  });
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

  // ─────────────────────────────────────────────────────────────────────────
  // handleIncoming — validate URL, probe metadata, show format card
  //   If forcedQuality is set (e.g. /audio command), skip the card entirely
  //   and go straight to the user's per-user queue.
  // ─────────────────────────────────────────────────────────────────────────
  async function handleIncoming(ctx, url, forcedQuality) {
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
        // Queue immediately with forced quality — no card needed
        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            status.message_id,
            undefined,
            `${pe("quote")} <b>${esc(info.title)}</b>\n${pe("mic")} Extracting audio…`,
            PARSE_HTML,
          )
          .catch(() => {});
        await enqueueDownload(ctx, {
          url: href,
          quality: forcedQuality,
          info,
          statusId: status.message_id,
        });
        return;
      }

      // Show format-selection card
      const id = rememberJob({
        url: href,
        info,
        userId: ctx.from.id,
        chatId: ctx.chat.id,
      });

      const caption = infoCard(info);
      let sentPhoto = false;
      if (info.thumbnail && /^https?:/i.test(info.thumbnail)) {
        try {
          await ctx.replyWithPhoto(info.thumbnail, {
            caption,
            ...PARSE_HTML,
            reply_markup: qualityKeyboard(id, info.sizes),
          });
          sentPhoto = true;
          await ctx.telegram.deleteMessage(ctx.chat.id, status.message_id).catch(() => {});
          return;
        } catch {
          /* thumbnail failed — status message still intact */
        }
      }

      if (!sentPhoto) {
        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            status.message_id,
            undefined,
            caption,
            { ...PARSE_HTML, reply_markup: qualityKeyboard(id, info.sizes) },
          )
          .catch(async () => {
            await ctx.reply(caption, {
              ...PARSE_HTML,
              reply_markup: qualityKeyboard(id, info.sizes),
            }).catch(() => {});
          });
      }
    } catch (err) {
      log("error", "probe failed", { err: err.message });
      const userErr = cleanError(err);
      if (!userErr) return;
      await ctx.telegram
        .editMessageText(
          ctx.chat.id,
          status.message_id,
          undefined,
          `${pe("warn")} ${esc(userErr)}`,
          PARSE_HTML,
        )
        .catch(async () => {
          await ctx.reply(`${pe("warn")} ${esc(userErr)}`, PARSE_HTML).catch(() => {});
        });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Callback query — user tapped a quality button
  // ─────────────────────────────────────────────────────────────────────────
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

    const parts   = data.split(":");
    const id      = parts[1];
    const quality = parts[2];
    const job     = jobs.get(id);

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
    await enqueueDownload(ctx, {
      url:      job.url,
      quality,
      info:     job.info,
      statusId: status.message_id,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // enqueueDownload — add to per-user queue and kick off if idle
  // ─────────────────────────────────────────────────────────────────────────
  async function enqueueDownload(ctx, { url, quality, info, statusId }) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const q      = getOrCreateUserQueue(userId);

    if (q.items.length >= MAX_QUEUE) {
      // Spam guard — tell the user and drop the request
      await ctx.reply(
        `${pe("warn")} Your queue is full (${MAX_QUEUE} items). Wait for some to finish or /cancel.`,
        PARSE_HTML,
      ).catch(() => {});
      return;
    }

    if (q.active) {
      // A download is running — push to back of queue and confirm
      q.items.push({ url, quality, info, chatId, statusId });
      const pos = q.items.length;
      await ctx.telegram
        .editMessageText(
          chatId,
          statusId,
          undefined,
          `${pe("list")} <b>Queued #${pos}</b> — will start after current download.\n${pe("quote")} ${esc(info?.title || url)}\n${pe("tag")} ${esc(qualityLabel(quality))}`,
          PARSE_HTML,
        )
        .catch(async () => {
          await ctx.reply(
            `${pe("list")} Queued #${pos}: <b>${esc(info?.title || url)}</b> · ${esc(qualityLabel(quality))}`,
            PARSE_HTML,
          ).catch(() => {});
        });
      log("info", "download queued", { userId, pos, url });
      return;
    }

    // Queue is idle — run immediately
    runNextInQueue(ctx.telegram, userId, chatId, { url, quality, info, statusId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // runNextInQueue — internal driver that processes items one at a time
  // ─────────────────────────────────────────────────────────────────────────
  function runNextInQueue(telegram, userId, chatId, item) {
    const q = getOrCreateUserQueue(userId);
    q.active = true;
    const ac = new AbortController();
    q.ac = ac;

    // Run the actual download, then automatically pull the next item
    runDownload(telegram, userId, chatId, { ...item, ac }).finally(() => {
      q.active = false;
      q.ac     = null;

      if (q.items.length === 0) return; // nothing pending

      // Notify the user their next download is starting
      const next = q.items.shift();
      const remaining = q.items.length;
      const queueNote = remaining > 0
        ? ` (${remaining} more in queue)`
        : "";

      telegram
        .editMessageText(
          next.chatId,
          next.statusId,
          undefined,
          `${pe("download")} Starting now${queueNote}…\n${pe("quote")} <b>${esc(next.info?.title || next.url)}</b>`,
          PARSE_HTML,
        )
        .catch(() => {
          // status message may have been deleted — send a fresh one
          telegram.sendMessage(
            next.chatId,
            `${pe("download")} Starting: <b>${esc(next.info?.title || next.url)}</b>`,
            PARSE_HTML,
          ).catch(() => {});
        });

      runNextInQueue(telegram, userId, next.chatId, next);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // runDownload — download one item and upload it to Telegram
  // ─────────────────────────────────────────────────────────────────────────
  async function runDownload(telegram, userId, chatId, { url, quality, info, statusId, ac }) {
    let lastEdit = 0;
    const bump = async (html) => {
      const now = Date.now();
      if (now - lastEdit < 2500) return;
      lastEdit = now;
      await telegram
        .editMessageText(chatId, statusId, undefined, html, PARSE_HTML)
        .catch(() => {});
    };

    let tempDir = null;

    try {
      const file = await enqueue(() =>
        downloadMedia(config, {
          url,
          quality,
          signal: ac.signal,
          isMtProto:    gramJsReady(),
          isLocalBotApi: config.isLocalBotApi,
          onProgress: (pct) => {
            bump(
              `${pe("download")} ${esc(info.title)}\n${pe("percent")} ${pct}% · ${esc(qualityLabel(quality))}`,
            );
          },
        }),
      );

      tempDir = file.dir;

      await bump(`${pe("pack")} Uploading to Telegram…`);

      const caption =
        `${pe("check")} <b>${esc(info.title)}</b>\n${pe("tag")} ${esc(qualityLabel(quality))} · ${esc(formatSize(file.size))}`;

      // ── MTProto path (GramJS) — up to 2 GB ─────────────────────────────
      if (gramJsReady()) {
        try {
          await gramJsSend({
            filePath: file.path,
            chatId,
            caption,
            kind: file.kind,
            meta: {
              title:    info.title,
              width:    file.width  || info.width  || 0,
              height:   file.height || info.height || 0,
              duration: info.duration || 0,
            },
            onProgress: (pct) => bump(`${pe("pack")} Uploading… ${pct}%`),
          });
          await telegram.deleteMessage(chatId, statusId).catch(() => {});
          return;
        } catch (uploadErr) {
          log("error", "gramjs upload failed — falling back to Bot API", {
            err: uploadErr.message,
          });
        }
      }

      // ── Bot API path — 50 MB cap ────────────────────────────────────────
      const source = { source: createReadStream(file.path) };
      try {
        if (file.kind === "audio") {
          await telegram.sendAudio(chatId, source, {
            caption,
            ...PARSE_HTML,
            title: info.title,
          });
        } else {
          await telegram.sendVideo(chatId, source, {
            caption,
            ...PARSE_HTML,
            supports_streaming: true,
            width:    file.width    || info.width    || undefined,
            height:   file.height   || info.height   || undefined,
            duration: info.duration || undefined,
          });
        }
      } catch {
        await telegram.sendDocument(
          chatId,
          { source: createReadStream(file.path), filename: filenameFor(info.title, file.ext) },
          { caption, ...PARSE_HTML },
        );
      }

      await telegram.deleteMessage(chatId, statusId).catch(() => {});

    } catch (err) {
      if (/Cancelled/i.test(err.message)) {
        log("info", "download cancelled", { userId, url });
      } else {
        log("error", "download failed", { err: err.message, userId });
      }
      await telegram
        .editMessageText(
          chatId,
          statusId,
          undefined,
          `${pe("warn")} ${esc(cleanError(err))}`,
          PARSE_HTML,
        )
        .catch(async () => {
          await telegram
            .sendMessage(chatId, `${pe("warn")} ${esc(cleanError(err))}`, PARSE_HTML)
            .catch(() => {});
        });
    } finally {
      if (tempDir) {
        await cleanupDir(tempDir);
        log("info", "temp dir deleted", { dir: tempDir });
      }
    }
  }

  bot.catch((err) => {
    log("error", "bot catch", { err: err.message });
  });

  return bot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (no bot state)
// ─────────────────────────────────────────────────────────────────────────────

function qualityLabel(q) {
  if (q === "audio") return "MP3";
  if (q === "best")  return "Best";
  return `${q}p`;
}

function formatSize(bytes) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024)       return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function filenameFor(title, ext) {
  const base = title.replace(/[^\w.\-]+/g, "_").slice(0, 60) || "media";
  return `${base}.${ext}`;
}

function cleanError(err) {
  const msg = String(err?.message || err);
  if (/Cancelled/i.test(msg))                  return "Cancelled.";
  if (/timed out/i.test(msg))                  return "That took too long. Try 480p or a shorter clip.";
  if (/Unsupported URL|No video/i.test(msg))   return "yt-dlp doesn't know that site or there's no video there.";
  if (/message to edit not found/i.test(msg))  return "Could not update status. Please try sending the link again.";
  if (/message is not modified/i.test(msg))    return "";
  if (/HTTP Error 410|410: Gone/i.test(msg))
    return "This video stream expired or was removed (410: Gone). If using COOKIES_B64, your cookies may have expired.";
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
