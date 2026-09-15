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
    "--socket-timeout",
    "30",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--user-agent",
    config.userAgent,
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
