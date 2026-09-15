import { useMemo, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Side = "bot" | "user";
type Kind = "text" | "card" | "progress" | "file";

type Msg = {
  id: number;
  side: Side;
  kind: Kind;
  body: string;
  meta?: string;
  pct?: number;
};

const SAMPLES = [
  { label: "YouTube", url: "https://youtu.be/jNQXAC9IVRw" },
  { label: "TikTok", url: "https://www.tiktok.com/@user/video/123" },
  { label: "Instagram", url: "https://www.instagram.com/reel/example" },
  { label: "X", url: "https://x.com/user/status/123" },
];

const WELCOME: Msg[] = [
  {
    id: 1,
    side: "bot",
    kind: "text",
    body: "ReelDrop is ready. Send a video link from YouTube, TikTok, Instagram, X, Reddit, Vimeo — or almost anywhere else.",
  },
];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function TelegramDemo() {
  const [messages, setMessages] = useState<Msg[]>(WELCOME);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "card" | "busy" | "done">("idle");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const canSend = input.trim().length > 0 && phase !== "busy";

  function push(msg: Omit<Msg, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: prev.length + 1 }]);
  }

  function reset() {
    setMessages(WELCOME);
    setInput("");
    setPhase("idle");
    setPendingUrl(null);
  }

  function submitUrl(raw: string) {
    const text = raw.trim();
    if (!text) return;
    push({ side: "user", kind: "text", body: text });
    setInput("");
    const ok = /^https?:\/\//i.test(text);
    if (!ok) {
      push({
        side: "bot",
        kind: "text",
        body: "I need an http(s) video link.",
      });
      return;
    }
    setPhase("busy");
    setPendingUrl(text);
    push({ side: "bot", kind: "text", body: "Reading the link…" });
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          id: prev.length,
          side: "bot",
          kind: "card",
          body: `Clip from ${hostOf(text)}`,
          meta: "3:04 · yt-dlp",
        },
      ]);
      setPhase("card");
    }, 700);
  }

  function pickQuality(label: string) {
    if (!pendingUrl) return;
    setPhase("busy");
    push({ side: "user", kind: "text", body: label });
    const progressId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: progressId, side: "bot", kind: "progress", body: "Downloading", pct: 8 },
    ]);
    let pct = 8;
    const tick = window.setInterval(() => {
      pct = Math.min(100, pct + 18);
      setMessages((prev) =>
        prev.map((m) => (m.id === progressId ? { ...m, pct } : m)),
      );
      if (pct >= 100) {
        window.clearInterval(tick);
        window.setTimeout(() => {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== progressId),
            {
              id: progressId + 1,
              side: "bot",
              kind: "file",
              body: `Clip from ${hostOf(pendingUrl)}`,
              meta: `${label} · 12.4 MB`,
            },
          ]);
          setPhase("done");
        }, 400);
      }
    }, 280);
  }

  const qualities = useMemo(
    () => ["Best", "1080p", "720p", "480p", "MP3"],
    [],
  );

  return (
    <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-soft">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-medium text-accent-fg">
            RD
          </span>
          <div>
            <p className="text-sm font-medium leading-tight">ReelDrop</p>
            <p className="text-xs text-subtle">Demo chat · no files leave this page</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex size-10 items-center justify-center rounded-sm text-muted transition-colors hover:bg-bg-subtle hover:text-fg"
          aria-label="Reset demo"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="flex max-h-[28rem] min-h-[22rem] flex-col gap-2 overflow-y-auto px-3 py-4">
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} />
        ))}
        {phase === "card" ? (
          <div className="flex flex-wrap gap-1.5 self-start pl-1">
            {qualities.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => pickQuality(q)}
                className="h-9 rounded-sm border border-border bg-bg-subtle px-3 text-xs font-medium text-fg transition-colors hover:bg-accent hover:text-accent-fg"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        {phase === "done" ? (
          <p className="px-1 text-xs text-subtle">
            Live Telegram sends the real file. This preview stops at the card.
          </p>
        ) : null}
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setInput(s.url)}
              className="h-8 rounded-sm border border-border px-2.5 text-xs text-muted transition-colors hover:text-fg"
            >
              {s.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitUrl(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a video URL"
            className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-bg px-3 text-sm text-fg outline-none ring-accent/40 placeholder:text-subtle focus:ring-2"
          />
          <Button type="submit" disabled={!canSend} aria-label="Send">
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const mine = msg.side === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-md px-3 py-2 text-sm leading-relaxed",
          mine
            ? "rounded-br-xs bg-accent text-accent-fg"
            : "rounded-bl-xs bg-bg-subtle text-fg",
        )}
      >
        {msg.kind === "progress" ? (
          <div className="w-44">
            <p className="mb-1.5 text-xs text-muted">{msg.body}</p>
            <div className="h-1 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${msg.pct ?? 0}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">
              {msg.pct}%
            </p>
          </div>
        ) : msg.kind === "file" ? (
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-sm bg-bg text-accent">
              <span className="ml-0.5 size-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
            </span>
            <div>
              <p className="font-medium">{msg.body}</p>
              <p className="text-xs text-muted">{msg.meta}</p>
            </div>
          </div>
        ) : msg.kind === "card" ? (
          <div>
            <p className="font-medium">{msg.body}</p>
            <p className="mt-0.5 text-xs text-muted">{msg.meta}</p>
          </div>
        ) : (
          <p>{msg.body}</p>
        )}
      </div>
    </div>
  );
}
