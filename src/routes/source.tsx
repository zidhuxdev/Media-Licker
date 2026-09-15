import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/source")({ component: SourcePage });

const FILES = [
  "src/index.js",
  "src/bot.js",
  "src/emoji.js",
  "src/downloader.js",
  "src/ytdlp.js",
  "src/ffmpeg.js",
  "src/urls.js",
  "src/queue.js",
  "src/server.js",
  "src/config.js",
  "Dockerfile",
  "railway.toml",
  "package.json",
  "env.example",
  "README.md",
];

function SourcePage() {
  const [active, setActive] = useState(FILES[0]);
  const [body, setBody] = useState("Loading…");

  useEffect(() => {
    let cancelled = false;
    fetch(`/reeldrop-bot/${active}`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("missing"))))
      .then((text) => {
        if (!cancelled) setBody(text);
      })
      .catch(() => {
        if (!cancelled) setBody("Could not load that file.");
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <PageShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl font-medium tracking-tight">Source</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          The Railway project, file by file. Premium emoji live in{" "}
          <code className="font-mono text-fg">src/emoji.js</code>. Download the zip
          from the Railway page to deploy it as-is.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[16rem_1fr]">
          <ul className="flex gap-1 overflow-x-auto lg:block lg:overflow-visible">
            {FILES.map((file) => (
              <li key={file} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(file)}
                  className={cn(
                    "h-10 w-full rounded-sm px-3 text-left font-mono text-xs transition-colors",
                    active === file
                      ? "bg-bg-subtle text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {file}
                </button>
              </li>
            ))}
          </ul>
          <pre className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-bg-elevated p-4 font-mono text-xs leading-relaxed text-fg">
            {body}
          </pre>
        </div>
      </main>
    </PageShell>
  );
}
