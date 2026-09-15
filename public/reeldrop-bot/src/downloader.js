import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureMp4UnderLimit } from "./ffmpeg.js";
import { parsePercent, spawnYtDlp } from "./ytdlp.js";

const FORMATS = {
  best: "bv*[height<=1080]+ba/b[height<=1080]/b",
  "1080": "bv*[height<=1080]+ba/b[height<=1080]/b",
  "720": "bv*[height<=720]+ba/b[height<=720]/b",
  "480": "bv*[height<=480]+ba/b[height<=480]/b",
  "360": "bv*[height<=360]+ba/b[height<=360]/b",
  audio: "ba/b",
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

export async function probe(config, url) {
  const { stdout } = await spawnYtDlp(
    config,
    ["--dump-single-json", "--skip-download", "--", url],
    { timeoutMs: 45_000 },
  );
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
  withStat.sort((a, b) => b.mtime - a.mtime);
  return withStat[0].path;
}

export async function downloadMedia(config, { url, quality, onProgress, signal, isMtProto = false }) {
  const dir = await mkdtemp(join(tmpdir(), "reeldrop-"));
  const maxBytes = Math.floor(config.maxFileMb * 1024 * 1024);
  const isAudio = quality === "audio";
  const format = FORMATS[quality] || FORMATS.best;

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
  try {
    await spawnYtDlp(config, args, {
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
    const raw = await newestFile(dir);
    // Only run ffmpeg compression when using the Bot API (50 MB cap)
    const ready = (isAudio || isMtProto) ? raw : await ensureMp4UnderLimit(config, raw, maxBytes);
    const s = await stat(ready);
    if (!isMtProto && s.size > maxBytes) {
      throw new Error(`File is still ${Math.ceil(s.size / 1024 / 1024)} MB after compression.`);
    }
    const ext = ready.split(".").pop()?.toLowerCase() || "mp4";
    return {
      path: ready,
      dir,
      size: s.size,
      ext,
      kind: isAudio || ext === "mp3" || ext === "m4a" ? "audio" : "video",
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
