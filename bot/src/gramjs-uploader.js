/**
 * gramjs-uploader.js
 *
 * Wraps the GramJS MTProto user client to upload large files (up to 2 GB)
 * to a Telegram chat on behalf of the bot account.
 *
 * The user client is authenticated once using TG_API_ID, TG_API_HASH, and
 * TG_SESSION (a StringSession produced by running the one-time auth helper).
 * Once logged in the session string never changes — just persist it as an env var.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { log } from "./logger.js";

let client = null; // GramJS TelegramClient, lazily set by initGramJs()
let Api = null; // GramJS Api namespace

/**
 * Call once at startup when TG_API_ID / TG_API_HASH / TG_SESSION are set.
 * Resolves to true if the client connected successfully, false otherwise.
 */
export async function initGramJs(config) {
  if (!config.tgApiId || !config.tgApiHash || !config.tgSession) {
    log("info", "gramjs: MTProto vars not set — using Bot API (50 MB limit)");
    return false;
  }

  try {
    // Dynamic import so the rest of the bot works without GramJS installed
    const { TelegramClient, sessions } = await import("telegram");
    const apiModule = await import("telegram/tl/index.js").catch(
      () => import("telegram"),
    );
    Api = apiModule.Api ?? apiModule.default?.Api;
    const { StringSession } = sessions;

    const session = new StringSession(config.tgSession);
    client = new TelegramClient(session, Number(config.tgApiId), config.tgApiHash, {
      connectionRetries: 5,
      useWSS: false,
    });

    await client.connect();
    const me = await client.getMe();
    log("info", "gramjs: MTProto client connected", { username: me.username });
    return true;
  } catch (err) {
    log("error", "gramjs: failed to init MTProto client — falling back to Bot API", {
      err: err.message,
    });
    client = null;
    return false;
  }
}

/** True when the MTProto client is ready */
export function gramJsReady() {
  return client !== null;
}

/**
 * Upload a file via MTProto and send it to a chat.
 *
 * @param {object} opts
 * @param {string}   opts.filePath   - Absolute path to the local file
 * @param {number}   opts.chatId     - Telegram numeric chat id
 * @param {string}   opts.caption    - HTML caption
 * @param {"video"|"audio"|"document"} opts.kind
 * @param {object}   opts.meta       - { title, width, height, duration }
 * @param {Function} [opts.onProgress] - (pct: number) => void
 * @returns {Promise<void>}
 */
export async function gramJsSend({ filePath, chatId, caption, kind, meta, onProgress }) {
  if (!client) throw new Error("MTProto client not initialized");

  const fileStat = await stat(filePath);
  const totalBytes = fileStat.size;

  // GramJS uploadFile with progress callback
  const uploaded = await client.uploadFile({
    file: createReadStream(filePath),
    workers: 4, // parallel upload chunks
    onProgress: (uploaded) => {
      if (onProgress && totalBytes > 0) {
        onProgress(Math.min(99, Math.round((uploaded / totalBytes) * 100)));
      }
    },
  });

  // Build the correct media object based on kind
  let media;
  if (kind === "audio") {
    media = new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: "audio/mpeg",
      attributes: [
        new Api.DocumentAttributeAudio({
          duration: meta.duration || 0,
          title: meta.title || "Audio",
          voice: false,
        }),
        new Api.DocumentAttributeFilename({
          fileName: `${(meta.title || "audio").slice(0, 60)}.mp3`,
        }),
      ],
    });
  } else if (kind === "video") {
    media = new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: "video/mp4",
      attributes: [
        new Api.DocumentAttributeVideo({
          duration: meta.duration || 0,
          w: meta.width || 0,
          h: meta.height || 0,
          supportsStreaming: true,
        }),
        new Api.DocumentAttributeFilename({
          fileName: `${(meta.title || "video").slice(0, 60)}.mp4`,
        }),
      ],
    });
  } else {
    // document fallback
    media = new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: "application/octet-stream",
      attributes: [
        new Api.DocumentAttributeFilename({
          fileName: `${(meta.title || "file").slice(0, 60)}`,
        }),
      ],
    });
  }

  // Strip HTML tags for plain text caption (GramJS uses entities, not HTML parse mode)
  const plainCaption = caption.replace(/<[^>]+>/g, "").trim();

  await client.sendFile(chatId, {
    file: uploaded,
    caption: plainCaption,
    forceDocument: kind === "document",
    attributes: media.attributes,
    mimeType: media.mimeType,
    workers: 4,
  });
}
