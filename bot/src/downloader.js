import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureCompatibleVideo } from "./ffmpeg.js";
import { log } from "./logger.js";
import { parsePercent, spawnYtDlp } from "./ytdlp.js";

// ---------------------------------------------------------------------------
// Format selection strategy
//
// Priority for every tier:
//   1. Native H.264 (avc1) + AAC/m4a  → fastest, no transcode needed
//   2. Native H.264 + any audio        → still fast, copy-remux only
//   3. Any video codec + AAC/m4a       → VP9/AV1 will be transcoded by ensureCompatibleVideo
//   4. Any video + any audio           → last resort, still transcoded if needed
//   5. Single-file best                → some sites only offer muxed streams
//
// "best" has NO height cap — user wants native dimensions.
// 1080/720/480 caps are enforced per quality tier.
// ensureCompatibleVideo() ALWAYS transcodes non-H.264 to H.264 so Telegram
// can play it — this is the safety net for VP9/AV1 fallbacks.
// ---------------------------------------------------------------------------
const FORMATS = {
  best: [
    "bestvideo[vcodec^=avc1]+bestaudio[ext=m4a]",
    "bestvideo[vcodec^=avc1]+bestaudio",
    "bestvideo+bestaudio[ext=m4a]",
    "bestvideo+bestaudio",
    "best",
  ].join("/"),

  "1080": [
    "bestvideo[vcodec^=avc1][height<=1080]+bestaudio[ext=m4a]",
    "bestvideo[vcodec^=avc1][height<=1080]+bestaudio",
    "bestvideo[height<=1080]+bestaudio[ext=m4a]",
    "bestvideo[height<=1080]+bestaudio",
    "best[height<=1080]",
    "best",
  ].join("/"),

  "720": [
    "bestvideo[vcodec^=avc1][height<=720]+bestaudio[ext=m4a]",
    "bestvideo[vcodec^=avc1][height<=720]+bestaudio",
    "bestvideo[height<=720]+bestaudio[ext=m4a]",
    "bestvideo[height<=720]+bestaudio",
    "best[height<=720]",
    "best",
  ].join("/"),

  "480": [
    "bestvideo[vcodec^=avc1][height<=480]+bestaudio[ext=m4a]",
    "bestvideo[vcodec^=avc1][height<=480]+bestaudio",
    "bestvideo[height<=480]+bestaudio[ext=m4a]",
    "bestvideo[height<=480]+bestaudio",
    "best[height<=480]",
    "best",
  ].join("/"),

  "360": [
    "bestvideo[vcodec^=avc1][height<=360]+bestaudio[ext=m4a]",
    "bestvideo[vcodec^=avc1][height<=360]+bestaudio",
    "bestvideo[height<=360]+bestaudio[ext=m4a]",
    "bestvideo[height<=360]+bestaudio",
    "best[height<=360]",
    "best",
  ].join("/"),

  audio: "bestaudio[ext=m4a]/bestaudio/best",
};

export function formatDuration(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return "unknown";
  const s = Math.max(0, Math.round(Number(sec)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function formatSize(bytes) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function estimateQualitySizes(info) {
  if (!info) return {};
  const formats = Array.isArray(info.formats) ? info.formats : [];
  const duration = Number(info.duration) || 0;

  function getFormatSize(f) {
    if (!f) return null;
    if (f.filesize && f.filesize > 0) return f.filesize;
    if (f.filesize_approx && f.filesize_approx > 0) return f.filesize_approx;
    const bitrate = f.tbr || ((f.vbr || 0) + (f.abr || 0));
    if (bitrate && bitrate > 0 && duration > 0) {
      return Math.round((bitrate * 1000 / 8) * duration);
    }
    return null;
  }

  const audioOnly = formats.filter(
    (f) => f.vcodec === "none" && f.acodec && f.acodec !== "none",
  );
  audioOnly.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
  const bestAudio = audioOnly[0];
  const audioSize = bestAudio ? getFormatSize(bestAudio) : null;

  const videoStreams = formats.filter((f) => f.vcodec && f.vcodec !== "none" && f.height);

  function findSizeForHeight(targetH, exact = false) {
    const pool = exact
      ? videoStreams.filter((f) => f.height === targetH)
      : videoStreams.filter((f) => f.height <= targetH);

    if (!pool.length) return null;

    pool.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
    const bestF = pool[0];
    const vSize = getFormatSize(bestF);
    if (!vSize) return null;

    const isMuxed = bestF.acodec && bestF.acodec !== "none";
    return isMuxed ? vSize : vSize + (audioSize || 0);
  }

  const maxH = videoStreams.reduce((max, f) => Math.max(max, f.height || 0), 0);

  // "best" estimates from the highest available quality (no cap)
  const bestBytes =
    findSizeForHeight(maxH || 9999) || info.filesize || info.filesize_approx;
  const p1080Bytes = maxH >= 1080 ? (findSizeForHeight(1080, true) || findSizeForHeight(1080)) : null;
  const p720Bytes = maxH >= 720 ? (findSizeForHeight(720, true) || findSizeForHeight(720)) : null;
  const p480Bytes = maxH >= 480 ? (findSizeForHeight(480, true) || findSizeForHeight(480)) : null;

  const finalAudioBytes =
    audioSize || (duration > 0 ? Math.round((128 * 1000 / 8) * duration) : null);

  const sizes = {
    best: formatSize(bestBytes),
    "1080": formatSize(p1080Bytes),
    "720": formatSize(p720Bytes),
    "480": formatSize(p480Bytes),
    audio: formatSize(finalAudioBytes),
  };

  if (!sizes.best && (info.filesize || info.filesize_approx)) {
    sizes.best = formatSize(info.filesize || info.filesize_approx);
  }

  return sizes;
}

export async function probe(config, url) {
  let stdout;
  try {
    const res = await spawnYtDlp(
      config,
      ["--dump-single-json", "--skip-download", "--", url],
      { timeoutMs: 45_000 },
    );
    stdout = res.stdout;
  } catch (err) {
    if (
      config.cookiesFile &&
      /HTTP Error 410|410: Gone|HTTP Error 403|403: Forbidden/i.test(err.message)
    ) {
      log("warn", "probe failed with cookies (expired session) — retrying without cookies", {
        err: err.message,
      });
      const noCookiesConfig = { ...config, cookiesFile: "" };
      const res = await spawnYtDlp(
        noCookiesConfig,
        ["--dump-single-json", "--skip-download", "--", url],
        { timeoutMs: 45_000 },
      );
      stdout = res.stdout;
    } else {
      throw err;
    }
  }
  const info = JSON.parse(stdout);
  if (info.is_live) {
    throw new Error("Live streams are not supported.");
  }
  if (info.duration && info.duration > config.maxDurationSec) {
    throw new Error(
      `That clip is ${formatDuration(info.duration)} — max is ${formatDuration(config.maxDurationSec)}.`,
    );
  }
  return {
    title: String(info.title || info.fulltitle || "Untitled").slice(0, 200),
    duration: info.duration ?? null,
    thumbnail: typeof info.thumbnail === "string" ? info.thumbnail : null,
    extractor: String(info.extractor_key || info.extractor || "web"),
    webpageUrl: info.webpage_url || url,
    width: info.width ?? null,
    height: info.height ?? null,
    sizes: estimateQualitySizes(info),
  };
}

async function newestFile(dir) {
  const names = await readdir(dir);
  if (!names.length) throw new Error("yt-dlp produced no file.");
  const withStat = await Promise.all(
    names.map(async (name) => {
      const path = join(dir, name);
      const s = await stat(path);
      return { path, mtime: s.mtimeMs, size: s.size };
    }),
  );
  // Pick the largest file — yt-dlp sometimes leaves temp/partial files
  withStat.sort((a, b) => b.size - a.size || b.mtime - a.mtime);
  return withStat[0].path;
}

export async function downloadMedia(
  config,
  { url, quality, onProgress, signal, isMtProto = false, isLocalBotApi = false },
) {
  const dir = await mkdtemp(join(tmpdir(), "reeldrop-"));
  const maxBytes = Math.floor(config.maxFileMb * 1024 * 1024);
  const isAudio = quality === "audio";
  const format = FORMATS[quality] || FORMATS.best;
  const isHighLimit = isMtProto || isLocalBotApi || Boolean(config.isLocalBotApi);

  const args = isAudio
    ? [
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        join(dir, "%(title).80s-%(id)s.%(ext)s"),
        "--",
        url,
      ]
    : [
        "-f",
        format,
        // Prefer h264 + m4a as a tiebreaker when multiple streams match
        "--format-sort",
        "vcodec:h264,acodec:m4a,quality,filesize",
        "--merge-output-format",
        "mp4",
        "--remux-video",
        "mp4",
        "-o",
        join(dir, "%(title).80s-%(id)s.%(ext)s"),
        "--",
        url,
      ];

  let lastPct = -1;
  const runYtDlp = (cfg) =>
    spawnYtDlp(cfg, args, {
      signal,
      onStderr: (chunk) => {
        const pct = parsePercent(chunk);
        if (pct == null) return;
        if (pct - lastPct >= 4 || pct >= 99) {
          lastPct = pct;
          onProgress?.(pct);
        }
      },
    });

  try {
    try {
      await runYtDlp(config);
    } catch (err) {
      if (
        config.cookiesFile &&
        /HTTP Error 410|410: Gone|HTTP Error 403|403: Forbidden/i.test(err.message)
      ) {
        log("warn", "download failed with cookies (expired session) — retrying without cookies", {
          err: err.message,
        });
        const noCookiesConfig = { ...config, cookiesFile: "" };
        await runYtDlp(noCookiesConfig);
      } else {
        throw err;
      }
    }

    const raw = await newestFile(dir);
    let ready, videoWidth, videoHeight;

    if (isAudio) {
      ready = raw;
      videoWidth = 0;
      videoHeight = 0;
    } else {
      const result = await ensureCompatibleVideo(config, raw, { maxBytes, isHighLimit });
      ready = result.path;
      videoWidth = result.width || 0;
      videoHeight = result.height || 0;
    }

    const s = await stat(ready);
    if (!isHighLimit && s.size > maxBytes) {
      throw new Error(
        `File is ${Math.ceil(s.size / 1024 / 1024)} MB — over the ${config.maxFileMb} MB limit.`,
      );
    }

    const ext = ready.split(".").pop()?.toLowerCase() || "mp4";
    return {
      path: ready,
      dir,
      size: s.size,
      ext,
      kind: isAudio || ext === "mp3" || ext === "m4a" ? "audio" : "video",
      width: videoWidth,
      height: videoHeight,
    };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function cleanupDir(dir) {
  if (!dir) return;
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
