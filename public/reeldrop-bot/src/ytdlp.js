import { spawn } from "node:child_process";

export function spawnYtDlp(config, args, { timeoutMs, onStderr, signal } = {}) {
  const extra = config.extraYtdlpArgs ? config.extraYtdlpArgs.split(/\s+/).filter(Boolean) : [];
  const fullArgs = [
    "--no-playlist",
    "--no-warnings",
    "--no-color",
    "--newline",
    "--restrict-filenames",
    "--no-mtime",
    "--no-part",                     // write directly — skip .part rename step
    "--ppa", "Merger+ffmpeg:-movflags +faststart", // put moov atom at start for instant streaming

    // ── YouTube: bypass datacenter IP bot detection ─────────────────────────
    "--extractor-args",
    config.bgutilPotUrl
      ? "youtube:player_client=web,mweb,android,web_embedded"
      : config.cookiesFile
        ? "youtube:player_client=web_embedded,mweb,android,web"
        : "youtube:player_client=web_embedded,mweb,android",

    ...(config.bgutilPotUrl
      ? ["--extractor-args", `youtubepot-bgutilhttp:base_url=${config.bgutilPotUrl}`]
      : []),

    // ── Speed: parallel fragment downloads ────────────────────────────────────
    "--concurrent-fragments", "16",  // 16 chunks at once (YouTube DASH/HLS/m3u8)
    "--buffer-size", "16K",          // per-connection read buffer
    "--http-chunk-size", "10M",      // request 10 MB slices (fewer round-trips)

    // ── Network: fast fail + aggressive retry ─────────────────────────────────
    "--socket-timeout", "15",        // bail on stalled socket after 15 s
    "--retries", "5",
    "--fragment-retries", "10",      // retry broken fragment chunks hard
    "--abort-on-unavailable-fragment",

    ...(config.userAgent ? ["--user-agent", config.userAgent] : []),
    ...extra,
    ...args,
  ];

  if (config.cookiesFile) {
    fullArgs.unshift("--cookies", config.cookiesFile);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(config.ytdlpPath, fullArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
      reject(new Error("Download timed out."));
    }, timeoutMs ?? config.downloadTimeoutMs);

    const onAbort = () => {
      killed = true;
      child.kill("SIGKILL");
      reject(new Error("Cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (buf) => {
      stdout += buf.toString("utf8");
    });
    child.stderr.on("data", (buf) => {
      const chunk = buf.toString("utf8");
      stderr += chunk;
      onStderr?.(chunk, stderr);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (killed) return;
      if (code === 0) {
        resolve({ stdout, stderr, child });
        return;
      }
      const hint = stderr.split("\n").filter(Boolean).slice(-4).join("\n");
      reject(new Error(hint || `yt-dlp exited with code ${code}`));
    });
  });
}

export function parsePercent(text) {
  const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}
