import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as PageShell } from "./utils-B0ebO2gq.mjs";
import { t as Button } from "./button-DL_Wrpiv.mjs";
import { i as Check, r as Copy } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/deploy-zq2TKlny.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STEPS = [
	{
		n: "01",
		title: "Create the bot",
		body: "Open @BotFather in Telegram. Send /newbot, pick a name and username, copy the token."
	},
	{
		n: "02",
		title: "Download this project",
		body: "Grab the zip — it is a self-contained Node app with a Dockerfile. Unzip and push to a GitHub repo, or drop the folder onto Railway."
	},
	{
		n: "03",
		title: "New Railway service",
		body: "New project → deploy from GitHub (this folder as the root). Railway reads railway.toml and builds with Docker so yt-dlp and ffmpeg are on the image."
	},
	{
		n: "04",
		title: "Set BOT_TOKEN",
		body: "Variables tab. Paste the BotFather token. Optionally WEBHOOK_URL after you generate a domain. Leave polling if you skip the webhook."
	},
	{
		n: "05",
		title: "Talk to it",
		body: "Open t.me/your_bot, tap Start, paste a video link. Give the service at least 1 GB RAM for 1080p merges."
	}
];
var ENV = `BOT_TOKEN=123456:your-token-here
MAX_FILE_MB=49
MAX_DURATION_SEC=1800
CONCURRENCY=2
# WEBHOOK_URL=https://your-service.up.railway.app
# ALLOWED_USER_IDS=123456789
# COOKIES_B64=`;
function DeployPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted",
				children: "Hosting"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl font-medium tracking-tight",
				children: "Railway in five steps"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-base leading-relaxed text-muted",
				children: "This dashboard is not the bot. The bot is the Node project in the zip — Docker, yt-dlp, ffmpeg, Telegraf, webhook or polling."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/reeldrop-bot.zip",
						children: "Download reeldrop-bot.zip"
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-12 space-y-6",
				children: STEPS.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "grid gap-2 rounded-lg border border-border bg-bg-elevated p-5 sm:grid-cols-[4rem_1fr] sm:gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-sm tabular-nums text-subtle",
						children: step.n
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl font-medium",
						children: step.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-relaxed text-muted",
						children: step.body
					})] })]
				}, step.n))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl font-medium",
						children: "Environment"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Required: BOT_TOKEN. Everything else has a default."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyBlock, { text: ENV })
				]
			})
		]
	}) });
}
function CopyBlock({ text }) {
	const [copied, setCopied] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mt-4 overflow-hidden rounded-md border border-border bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "absolute right-2 top-2 inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-bg-elevated px-2.5 text-xs text-muted hover:text-fg",
			onClick: async () => {
				await navigator.clipboard.writeText(text);
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1500);
			},
			children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), copied ? "Copied" : "Copy"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg",
			children: text
		})]
	});
}
//#endregion
export { DeployPage as component };
