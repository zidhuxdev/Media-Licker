import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { log } from "./logger.js";

function run(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin} timed out.`));
    }, timeoutMs);
    child.stderr.on("data", (b) => {
      stderr += b.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.split("\n").filter(Boolean).slice(-3).join("\n") || `${bin} failed`));
    });
  });
}

function runOutput(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin} timed out.`));
    }, timeoutMs);
    child.stdout.on("data", (b) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.split("\n").filter(Boolean).slice(-3).join("\n") || `${bin} failed`));
    });
  });
}

export async function probeVideo(ffprobePath, filePath) {
  try {
    const out = await runOutput(
      ffprobePath || "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,pix_fmt",
        "-of",
        "json",
        filePath,
      ],
      20_000,
    );
    const parsed = JSON.parse(out);
    const stream = parsed.streams?.[0];
    return {
      vcodec: String(stream?.codec_name || "").toLowerCase(),
      pixFmt: String(stream?.pix_fmt || "").toLowerCase(),
    };
  } catch (err) {
    log("warn", "ffprobe failed or unavailable, continuing with caution", { err: err.message });
    return { vcodec: "", pixFmt: "" };
  }
}

export async function ensureCompatibleVideo(config, filePath, { maxBytes, isHighLimit } = {}) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const audioExt = new Set(["mp3", "m4a", "aac", "opus", "ogg", "wav", "flac"]);
  if (audioExt.has(ext)) return filePath;

  const dir = dirname(filePath);
  let work = filePath;

  // 1. Inspect video stream codec & pixel format
  const probe = await probeVideo(config.ffprobePath, filePath);
  // Telegram mobile (iOS/Android) requires H.264 (AVC) and 8-bit yuv420p
  const isH264 = probe.vcodec === "h264";
  const isYuv420p = !probe.pixFmt || probe.pixFmt === "yuv420p";
  const needsTranscode = (!isH264 && probe.vcodec !== "") || !isYuv420p;

  if (needsTranscode) {
    log("info", "transcoding video to Telegram-compatible H.264 (yuv420p)", {
      fromCodec: probe.vcodec || "unknown",
      fromPixFmt: probe.pixFmt || "unknown",
    });
    const transcoded = join(dir, `compat-${Date.now()}.mp4`);
    await run(
      config.ffmpegPath,
      [
        "-y",
        "-i",
        filePath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        transcoded,
      ],
      300_000,
    );
    work = transcoded;
  } else {
    // Already H.264 & yuv420p — ensure moov atom is at the beginning for instant Telegram streaming
    const faststarted = join(dir, `fast-${Date.now()}.mp4`);
    try {
      await run(
        config.ffmpegPath,
        ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", faststarted],
        60_000,
      );
      work = faststarted;
    } catch {
      // If fast copy fails, continue with work
    }
  }

  // 2. If using standard Bot API (50 MB limit) and file exceeds limit, compress
  const info = await stat(work);
  if (isHighLimit || info.size <= maxBytes) {
    return work;
  }

  log("info", "compressing video to fit under 50 MB limit", {
    originalSizeMb: (info.size / 1024 / 1024).toFixed(1),
    maxMb: (maxBytes / 1024 / 1024).toFixed(1),
  });

  const shrunk = join(dir, `fit-${Date.now()}.mp4`);
  await run(
    config.ffmpegPath,
    [
      "-y",
      "-i",
      work,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-vf",
      "scale='min(854,iw)':-2",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "80k",
      "-movflags",
      "+faststart",
      "-fs",
      String(maxBytes),
      shrunk,
    ],
    300_000,
  );

  const shrunkStat = await stat(shrunk);
  if (shrunkStat.size === 0) {
    throw new Error("File is over Telegram’s 50 MB bot limit even after compression.");
  }
  return shrunk;
}

export const ensureMp4UnderLimit = ensureCompatibleVideo;
