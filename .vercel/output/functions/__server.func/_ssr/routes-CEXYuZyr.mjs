import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as cn, t as PageShell } from "./utils-B0ebO2gq.mjs";
import { t as Button } from "./button-DL_Wrpiv.mjs";
import { a as ArrowUp, n as RotateCcw, o as ArrowRight } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CEXYuZyr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SAMPLES = [
	{
		label: "YouTube",
		url: "https://youtu.be/jNQXAC9IVRw"
	},
	{
		label: "TikTok",
		url: "https://www.tiktok.com/@user/video/123"
	},
	{
		label: "Instagram",
		url: "https://www.instagram.com/reel/example"
	},
	{
		label: "X",
		url: "https://x.com/user/status/123"
	}
];
var WELCOME = [{
	id: 1,
	side: "bot",
	kind: "text",
	body: "ReelDrop is ready. Send a video link from YouTube, TikTok, Instagram, X, Reddit, Vimeo — or almost anywhere else."
}];
function hostOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "link";
	}
}
function TelegramDemo() {
	const [messages, setMessages] = (0, import_react.useState)(WELCOME);
	const [input, setInput] = (0, import_react.useState)("");
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [pendingUrl, setPendingUrl] = (0, import_react.useState)(null);
	const canSend = input.trim().length > 0 && phase !== "busy";
	function push(msg) {
		setMessages((prev) => [...prev, {
			...msg,
			id: prev.length + 1
		}]);
	}
	function reset() {
		setMessages(WELCOME);
		setInput("");
		setPhase("idle");
		setPendingUrl(null);
	}
	function submitUrl(raw) {
		const text = raw.trim();
		if (!text) return;
		push({
			side: "user",
			kind: "text",
			body: text
		});
		setInput("");
		if (!/^https?:\/\//i.test(text)) {
			push({
				side: "bot",
				kind: "text",
				body: "I need an http(s) video link."
			});
			return;
		}
		setPhase("busy");
		setPendingUrl(text);
		push({
			side: "bot",
			kind: "text",
			body: "Reading the link…"
		});
		window.setTimeout(() => {
			setMessages((prev) => [...prev.slice(0, -1), {
				id: prev.length,
				side: "bot",
				kind: "card",
				body: `Clip from ${hostOf(text)}`,
				meta: "3:04 · yt-dlp"
			}]);
			setPhase("card");
		}, 700);
	}
	function pickQuality(label) {
		if (!pendingUrl) return;
		setPhase("busy");
		push({
			side: "user",
			kind: "text",
			body: label
		});
		const progressId = Date.now();
		setMessages((prev) => [...prev, {
			id: progressId,
			side: "bot",
			kind: "progress",
			body: "Downloading",
			pct: 8
		}]);
		let pct = 8;
		const tick = window.setInterval(() => {
			pct = Math.min(100, pct + 18);
			setMessages((prev) => prev.map((m) => m.id === progressId ? {
				...m,
				pct
			} : m));
			if (pct >= 100) {
				window.clearInterval(tick);
				window.setTimeout(() => {
					setMessages((prev) => [...prev.filter((m) => m.id !== progressId), {
						id: progressId + 1,
						side: "bot",
						kind: "file",
						body: `Clip from ${hostOf(pendingUrl)}`,
						meta: `${label} · 12.4 MB`
					}]);
					setPhase("done");
				}, 400);
			}
		}, 280);
	}
	const qualities = (0, import_react.useMemo)(() => [
		"Best",
		"1080p",
		"720p",
		"480p",
		"MP3"
	], []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-soft",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-line px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-8 place-items-center rounded-full bg-accent text-xs font-medium text-accent-fg",
						children: "RD"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium leading-tight",
						children: "ReelDrop"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-subtle",
						children: "Demo chat · no files leave this page"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: reset,
					className: "inline-flex size-10 items-center justify-center rounded-sm text-muted transition-colors hover:bg-bg-subtle hover:text-fg",
					"aria-label": "Reset demo",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex max-h-[28rem] min-h-[22rem] flex-col gap-2 overflow-y-auto px-3 py-4",
				children: [
					messages.map((msg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bubble, { msg }, msg.id)),
					phase === "card" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1.5 self-start pl-1",
						children: qualities.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => pickQuality(q),
							className: "h-9 rounded-sm border border-border bg-bg-subtle px-3 text-xs font-medium text-fg transition-colors hover:bg-accent hover:text-accent-fg",
							children: q
						}, q))
					}) : null,
					phase === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-1 text-xs text-subtle",
						children: "Live Telegram sends the real file. This preview stops at the card."
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-line p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 flex flex-wrap gap-1.5",
					children: SAMPLES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setInput(s.url),
						className: "h-8 rounded-sm border border-border px-2.5 text-xs text-muted transition-colors hover:text-fg",
						children: s.label
					}, s.label))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex gap-2",
					onSubmit: (e) => {
						e.preventDefault();
						submitUrl(input);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: input,
						onChange: (e) => setInput(e.target.value),
						placeholder: "Paste a video URL",
						className: "h-11 min-w-0 flex-1 rounded-sm border border-border bg-bg px-3 text-sm text-fg outline-none ring-accent/40 placeholder:text-subtle focus:ring-2"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: !canSend,
						"aria-label": "Send",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
					})]
				})]
			})
		]
	});
}
function Bubble({ msg }) {
	const mine = msg.side === "user";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex", mine ? "justify-end" : "justify-start"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("max-w-[85%] rounded-md px-3 py-2 text-sm leading-relaxed", mine ? "rounded-br-xs bg-accent text-accent-fg" : "rounded-bl-xs bg-bg-subtle text-fg"),
			children: msg.kind === "progress" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-44",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1.5 text-xs text-muted",
						children: msg.body
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-1 overflow-hidden rounded-full bg-bg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-accent transition-[width] duration-200",
							style: { width: `${msg.pct ?? 0}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-mono text-xs tabular-nums text-muted",
						children: [msg.pct, "%"]
					})
				]
			}) : msg.kind === "file" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "grid size-10 place-items-center rounded-sm bg-bg text-accent",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-0.5 size-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: msg.body
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted",
					children: msg.meta
				})] })]
			}) : msg.kind === "card" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: msg.body
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted",
				children: msg.meta
			})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: msg.body })
		})
	});
}
var platforms = [
	"YouTube",
	"TikTok",
	"Instagram",
	"X",
	"Reddit",
	"Vimeo",
	"Facebook",
	"Twitch"
];
var steps = [
	{
		n: "01",
		title: "Paste a link",
		body: "The bot reads the page with yt-dlp and shows title, duration, and source."
	},
	{
		n: "02",
		title: "Pick a format",
		body: "Best, 1080p, 720p, 480p, or MP3. Premium emoji sit on every button."
	},
	{
		n: "03",
		title: "Get the file",
		body: "Progress in chat, then the video or audio comes back as a Telegram file."
	}
];
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted",
					children: "Telegram bot · Railway"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "font-display text-4xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-5xl lg:text-6xl",
					children: [
						"Any link.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"The actual file."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-5 max-w-md text-base leading-relaxed text-muted",
					children: "ReelDrop is a Node.js Telegram bot that uses yt-dlp to pull video and audio from a thousand sites, then sends the file back in the chat. This page is the companion console. The bot you deploy lives on Railway."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 flex flex-wrap gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/deploy",
							children: ["Deploy on Railway", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "secondary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "/reeldrop-bot.zip",
							children: "Download project"
						})
					})]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelegramDemo, {})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "border-t border-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-6xl px-4 py-10 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted",
					children: "Sites"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [platforms.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "inline-flex h-9 items-center rounded-sm border border-border bg-bg-elevated px-3 text-sm",
						children: name
					}, name)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "inline-flex h-9 items-center px-2 text-sm text-subtle",
						children: "+ yt-dlp extractors"
					})]
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "border-t border-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3",
				children: steps.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg border border-border bg-bg-elevated p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs tabular-nums text-subtle",
							children: step.n
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-3 font-display text-2xl font-medium tracking-tight",
							children: step.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-muted",
							children: step.body
						})
					]
				}, step.n))
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "border-t border-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-6xl px-4 py-14 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl font-medium tracking-tight",
					children: "Limits"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-6 grid gap-3 text-sm text-muted md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-border bg-bg-elevated px-4 py-3",
							children: "Telegram bots cap uploads at about 50 MB. The bot compresses toward that."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-border bg-bg-elevated px-4 py-3",
							children: "Default max duration is 30 minutes. Live streams and playlists are skipped."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-border bg-bg-elevated px-4 py-3",
							children: "Premium emoji render if the bot owner has Telegram Premium, or the bot has a Fragment username."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-border bg-bg-elevated px-4 py-3",
							children: "One download at a time per person. Use /cancel to stop a job."
						})
					]
				})]
			})
		})
	] }) });
}
//#endregion
export { Home as component };
