import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { PageShell } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/deploy")({ component: DeployPage });

const STEPS = [
  {
    n: "01",
    title: "Create the bot",
    body: "Open @BotFather in Telegram. Send /newbot, pick a name and username, copy the token.",
  },
  {
    n: "02",
    title: "Download this project",
    body: "Grab the zip — it is a self-contained Node app with a Dockerfile. Unzip and push to a GitHub repo, or drop the folder onto Railway.",
  },
  {
    n: "03",
    title: "New Railway service",
    body: "New project → deploy from GitHub (this folder as the root). Railway reads railway.toml and builds with Docker so yt-dlp and ffmpeg are on the image.",
  },
  {
    n: "04",
    title: "Set BOT_TOKEN",
    body: "Variables tab. Paste the BotFather token. Optionally WEBHOOK_URL after you generate a domain. Leave polling if you skip the webhook.",
  },
  {
    n: "05",
    title: "Talk to it",
    body: "Open t.me/your_bot, tap Start, paste a video link. Give the service at least 1 GB RAM for 1080p merges.",
  },
];

const ENV = `BOT_TOKEN=123456:your-token-here
MAX_FILE_MB=49
MAX_DURATION_SEC=1800
CONCURRENCY=2
# WEBHOOK_URL=https://your-service.up.railway.app
# ALLOWED_USER_IDS=123456789
# COOKIES_B64=`;

function DeployPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Hosting
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight">
          Railway in five steps
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          This dashboard is not the bot. The bot is the Node project in the zip
          — Docker, yt-dlp, ffmpeg, Telegraf, webhook or polling.
        </p>

        <div className="mt-8">
          <Button asChild>
            <a href="/reeldrop-bot.zip">Download reeldrop-bot.zip</a>
          </Button>
        </div>

        <ol className="mt-12 space-y-6">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="grid gap-2 rounded-lg border border-border bg-bg-elevated p-5 sm:grid-cols-[4rem_1fr] sm:gap-6"
            >
              <p className="font-mono text-sm tabular-nums text-subtle">{step.n}</p>
              <div>
                <h2 className="font-display text-xl font-medium">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">Environment</h2>
          <p className="mt-2 text-sm text-muted">
            Required: BOT_TOKEN. Everything else has a default.
          </p>
          <CopyBlock text={ENV} />
        </section>
      </main>
    </PageShell>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-4 overflow-hidden rounded-md border border-border bg-bg">
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-bg-elevated px-2.5 text-xs text-muted hover:text-fg"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg">
        {text}
      </pre>
    </div>
  );
}
