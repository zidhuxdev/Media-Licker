import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Demo" },
  { to: "/deploy", label: "Railway" },
  { to: "/source", label: "Source" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-sm border border-border bg-bg-elevated">
            <span className="size-3 rounded-full border-2 border-accent" />
          </span>
          <span className="font-display text-lg font-medium tracking-tight">
            ReelDrop
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex h-10 items-center rounded-sm px-3 text-sm text-muted transition-colors duration-150 hover:text-fg"
              activeProps={{ className: "text-fg" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>ReelDrop · Telegram · yt-dlp · Railway</p>
        <p>Download only media you have the right to keep.</p>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="film-grain" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-y-0 left-0 hidden w-3 film-rail md:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-3 film-rail md:block"
        aria-hidden="true"
      />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
