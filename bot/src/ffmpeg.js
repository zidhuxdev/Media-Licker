import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";

function run(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timed out."));
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
      else reject(new Error(stderr.split("\n").filter(Boolean).slice(-3).join("\n") || "ffmpeg failed"));
    });
  });
}

export async function ensureMp4UnderLimit(config, filePath, maxBytes) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const audioExt = new Set(["mp3", "m4a", "aac", "opus", "ogg", "wav", "flac"]);
  if (audioExt.has(ext)) return filePath;

  const dir = dirname(filePath);
  let work = filePath;

  if (ext !== "mp4") {
    const remuxed = join(dir, `remux-${Date.now()}.mp4`);
    try {
      await run(
        config.ffmpegPath,
        ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", remuxed],
        60_000,
      );
      work = remuxed;
    } catch {
      const transcoded = join(dir, `tx-${Date.now()}.mp4`);
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
          "28",
          "-c:a",
          "aac",
          "-b:a",
          "96k",
          "-movflags",
          "+faststart",
          transcoded,
        ],
        120_000,
      );
      work = transcoded;
    }
  }

  const info = await stat(work);
  if (info.size <= maxBytes) return work;

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
      "32",
      "-vf",
      "scale='min(854,iw)':-2",
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
    180_000,
  );
  const shrunkStat = await stat(shrunk);
  if (shrunkStat.size === 0) {
    throw new Error("File is over Telegram’s 50 MB bot limit even after compression.");
  }
  return shrunk;
}
