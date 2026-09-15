import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/site-header";
import { TelegramDemo } from "@/components/telegram-demo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

const platforms = [
  "YouTube",
  "TikTok",
  "Instagram",
  "X",
  "Reddit",
  "Vimeo",
  "Facebook",
  "Twitch",
];

const steps = [
  {
    n: "01",
    title: "Paste a link",
    body: "The bot reads the page with yt-dlp and shows title, duration, and source.",
  },
  {
    n: "02",
    title: "Pick a format",
    body: "Best, 1080p, 720p, 480p, or MP3. Premium emoji sit on every button.",
  },
  {
    n: "03",
    title: "Get the file",
    body: "Progress in chat, then the video or audio comes back as a Telegram file.",
  },
];

function Home() {
  return (
    <PageShell>
      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Telegram bot · Railway
            </p>
            <h1 className="font-display text-4xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Any link.
              <br />
              The actual file.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              ReelDrop is a Node.js Telegram bot that uses yt-dlp to pull video
              and audio from a thousand sites, then sends the file back in the
              chat. This page is the companion console. The bot you deploy lives
              on Railway.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/deploy">
                  Deploy on Railway
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <a href="/reeldrop-bot.zip">Download project</a>
              </Button>
            </div>
          </div>
          <TelegramDemo />
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Sites
            </p>
            <div className="flex flex-wrap gap-2">
              {platforms.map((name) => (
                <span
                  key={name}
                  className="inline-flex h-9 items-center rounded-sm border border-border bg-bg-elevated px-3 text-sm"
                >
                  {name}
                </span>
              ))}
              <span className="inline-flex h-9 items-center px-2 text-sm text-subtle">
                + yt-dlp extractors
              </span>
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.n}
                className="rounded-lg border border-border bg-bg-elevated p-6"
              >
                <p className="font-mono text-xs tabular-nums text-subtle">{step.n}</p>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="font-display text-3xl font-medium tracking-tight">Limits</h2>
            <ul className="mt-6 grid gap-3 text-sm text-muted md:grid-cols-2">
              <li className="rounded-md border border-border bg-bg-elevated px-4 py-3">
                Telegram bots cap uploads at about 50 MB. The bot compresses toward that.
              </li>
              <li className="rounded-md border border-border bg-bg-elevated px-4 py-3">
                Default max duration is 30 minutes. Live streams and playlists are skipped.
              </li>
              <li className="rounded-md border border-border bg-bg-elevated px-4 py-3">
                Premium emoji render if the bot owner has Telegram Premium, or the bot has a Fragment username.
              </li>
              <li className="rounded-md border border-border bg-bg-elevated px-4 py-3">
                One download at a time per person. Use /cancel to stop a job.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
