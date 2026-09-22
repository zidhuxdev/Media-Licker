import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// spawnYtDlp — wraps yt-dlp with production-grade args for speed + stability
// ---------------------------------------------------------------------------

export function spawnYtDlp(config, args, { timeoutMs, onStderr, signal } = {}) {
  const extra = config.extraYtdlpArgs ? config.extraYtdlpArgs.split(/\s+/).filter(Boolean) : [];

  const fullArgs = [
    "--no-playlist",
    "--no-warnings",
    "--no-color",
    "--newline",
    "--restrict-filenames",
    "--no-mtime",
    "--no-part",                      // write directly — skip .part rename step

    // ── Container: put moov atom at start for instant Telegram streaming ─────
    "--ppa", "Merger+ffmpeg:-movflags +faststart",

    // ── ffmpeg merge: multi-threaded (0 = auto all cores) ───────────────────
    "--ppa", "ffmpeg_i:-threads 0",

    // ── YouTube: bypass datacenter IP bot detection ──────────────────────────
    "--extractor-args",
    config.bgutilPotUrl
      ? "youtube:player_client=web,mweb,android,web_embedded"
      : config.cookiesFile
        ? "youtube:player_client=web_embedded,mweb,android,web"
        : "youtube:player_client=web_embedded,mweb,android",

    ...(config.bgutilPotUrl
      ? ["--extractor-args", `youtubepot-bgutilhttp:base_url=${config.bgutilPotUrl}`]
      : []),

    // ── Speed: aggressive parallel fragment downloading ───────────────────────
    "--concurrent-fragments", "20",   // 20 parallel chunks (was 16)
    "--buffer-size", "32K",           // larger per-connection read buffer
    "--http-chunk-size", "10M",       // 10 MB slices → fewer round-trips

    // ── Network: fast fail + aggressive retry ────────────────────────────────
    "--socket-timeout", "15",         // bail on stalled socket after 15 s
    "--retries", "8",                 // retry top-level request up to 8×
    "--fragment-retries", "15",       // retry broken DASH/HLS chunks hard
    "--file-access-retries", "5",     // handle transient disk-write errors
    "--retry-sleep", "linear=1::2",  // 1 s base, double each retry, cap 2×

    // ── Abort on unavailable fragment but keep going on extractor errors ──────
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

// ---------------------------------------------------------------------------
// parsePercent — extract download progress from yt-dlp stderr lines
// ---------------------------------------------------------------------------

export function parsePercent(text) {
  const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}
