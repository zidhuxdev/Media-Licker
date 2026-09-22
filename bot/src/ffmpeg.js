import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { log } from "./logger.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// probeVideo — reads codec, pixel format, rotation, and actual display dims
// ---------------------------------------------------------------------------

/**
 * @returns {{ vcodec, pixFmt, width, height, rotation }}
 *   width/height are the *display* dimensions — already swapped for 90°/270°.
 */
export async function probeVideo(ffprobePath, filePath) {
  try {
    const out = await runOutput(
      ffprobePath || "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,pix_fmt,width,height,side_data_list",
        "-show_entries", "stream_tags=rotate",
        "-of", "json",
        filePath,
      ],
      10_000, // metadata only — 10 s is more than enough
    );
    const parsed = JSON.parse(out);
    const stream = parsed.streams?.[0];

    // Detect rotation from metadata tag OR Display Matrix side data
    // (different encoders use different mechanisms)
    let rotation = 0;
    const tagRotate = Number(stream?.tags?.rotate ?? 0);
    if (tagRotate) {
      rotation = tagRotate;
    } else {
      for (const sd of (stream?.side_data_list ?? [])) {
        if (sd.side_data_type === "Display Matrix" && sd.rotation != null) {
          // ffprobe reports counter-clockwise degrees; negate for intuitive clockwise
          rotation = -sd.rotation;
          break;
        }
      }
    }

    let width = Number(stream?.width || 0);
    let height = Number(stream?.height || 0);

    // Swap w/h when rotated 90° or 270° so callers get display dimensions
    const absRot = Math.abs(rotation) % 360;
    if (absRot === 90 || absRot === 270) {
      [width, height] = [height, width];
    }

    return {
      vcodec: String(stream?.codec_name || "").toLowerCase(),
      pixFmt: String(stream?.pix_fmt || "").toLowerCase(),
      width,
      height,
      rotation,
    };
  } catch (err) {
    log("warn", "ffprobe failed — will proceed without codec info", { err: err.message });
    return { vcodec: "", pixFmt: "", width: 0, height: 0, rotation: 0 };
  }
}

// ---------------------------------------------------------------------------
// ensureCompatibleVideo
//
// Guarantees the output file is:
//   • H.264 (libx264) + AAC in an MP4 container
//   • 8-bit YUV420p pixel format (required by Telegram mobile)
//   • Rotation physically baked in + metadata tag cleared
//   • moov atom at start (faststart) for instant streaming
//
// DOES NOT resize or crop — dimensions are always preserved exactly.
// Only the libx264 "even pixels" constraint is enforced via trunc(x/2)*2,
// which at most changes each edge by 1px.
//
// Returns { path, width, height } where width/height are the final display
// dimensions as reported by ffprobe, ready to pass to Telegram.
// ---------------------------------------------------------------------------

export async function ensureCompatibleVideo(config, filePath, { maxBytes, isHighLimit } = {}) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const audioExt = new Set(["mp3", "m4a", "aac", "opus", "ogg", "wav", "flac"]);
  if (audioExt.has(ext)) return { path: filePath, width: 0, height: 0 };

  const dir = dirname(filePath);
  let work = filePath;

  // ── Step 1: Inspect downloaded file ────────────────────────────────────────
  const probe = await probeVideo(config.ffprobePath, filePath);
  const isH264   = probe.vcodec === "h264";
  const isYuv420 = !probe.pixFmt || probe.pixFmt === "yuv420p";
  const hasRot   = probe.rotation !== 0;

  // Transcode is needed when:
  //   • video codec is NOT h264 (VP9, AV1, hevc, etc.) ← YouTube audio-only fix
  //   • pixel format is NOT yuv420p (e.g. yuv420p10le, yuvj420p)
  //   • rotation metadata exists (bake it in so Telegram shows correct orientation)
  // If ffprobe returned empty vcodec (file unreadable), skip transcode and let
  // Telegram fail naturally — attempting a blind transcode may make things worse.
  const needsTranscode = (probe.vcodec !== "" && !isH264) || !isYuv420 || hasRot;

  if (needsTranscode) {
    log("info", "transcoding to H.264/yuv420p for Telegram compatibility", {
      fromCodec:  probe.vcodec || "unknown",
      fromPixFmt: probe.pixFmt || "unknown",
      rotation:   probe.rotation,
      filePath,
    });

    const transcoded = join(dir, `compat-${Date.now()}.mp4`);

    // scale=trunc(iw/2)*2:trunc(ih/2)*2  ← enforces even pixel counts required
    // by libx264. At most 1px removed per edge — NOT a resize.
    // ffmpeg's autorotate filter is ON by default so rotation is baked in automatically.
    await run(
      config.ffmpegPath,
      [
        "-y",
        "-i", filePath,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",            // high quality — visually lossless
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-pix_fmt", "yuv420p",
        "-metadata:s:v", "rotate=0",  // clear rotation tag to prevent double-rotate
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        transcoded,
      ],
      600_000, // 10 min — 4K transcode can be slow
    );
    work = transcoded;

  } else {
    // ── Already H.264/yuv420p — stream-copy + faststart ──────────────────────
    // This is essentially free (no re-encode), just remuxes the container
    // so the moov atom is at the beginning for instant Telegram playback.
    const faststarted = join(dir, `fast-${Date.now()}.mp4`);
    try {
      await run(
        config.ffmpegPath,
        ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", faststarted],
        60_000,
      );
      work = faststarted;
    } catch (err) {
      log("warn", "faststart remux failed — using original file", { err: err.message });
      // fall through: work stays as filePath — still playable, just no faststart
    }
  }

  // ── Step 2: Get final display dimensions from the processed file ────────────
  const finalProbe = await probeVideo(config.ffprobePath, work);
  const finalWidth  = finalProbe.width  || probe.width  || 0;
  const finalHeight = finalProbe.height || probe.height || 0;

  // ── Step 3: Check size vs upload limit ─────────────────────────────────────
  const info = await stat(work);

  if (isHighLimit || info.size <= maxBytes) {
    return { path: work, width: finalWidth, height: finalHeight };
  }

  // ── Step 4: File too large for standard Bot API (50 MB cap) ─────────────────
  // We reduce bitrate via higher CRF — NO resizing/scaling.
  // CRF 32 cuts bitrate ~4–5× vs CRF 18 while keeping the original resolution.
  // Note: -fs (hard file-size stop) is intentionally NOT used — it produces
  // truncated/broken MP4 files that Telegram rejects.
  log("info", "re-encoding at lower bitrate to meet upload limit (no resize)", {
    originalSizeMb: (info.size / 1024 / 1024).toFixed(1),
    maxMb:          (maxBytes / 1024 / 1024).toFixed(1),
  });

  const shrunk = join(dir, `fit-${Date.now()}.mp4`);
  await run(
    config.ffmpegPath,
    [
      "-y",
      "-i", work,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "32",             // aggressive CRF — reduces size ~4× without resize
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",  // even-pixel safety only
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "96k",
      "-movflags", "+faststart",
      shrunk,
    ],
    600_000,
  );

  const shrunkStat = await stat(shrunk);
  if (shrunkStat.size === 0) {
    throw new Error("Compression produced an empty file — this is a bug.");
  }

  // Re-probe for accurate final dimensions after re-encode
  const shrunkProbe = await probeVideo(config.ffprobePath, shrunk);
  return {
    path:   shrunk,
    width:  shrunkProbe.width  || finalWidth,
    height: shrunkProbe.height || finalHeight,
  };
}

export const ensureMp4UnderLimit = ensureCompatibleVideo;
