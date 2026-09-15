import { _ as Link, y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-B0ebO2gq.js
var import_jsx_runtime = require_jsx_runtime();
var links = [
	{
		to: "/",
		label: "Demo"
	},
	{
		to: "/deploy",
		label: "Railway"
	},
	{
		to: "/source",
		label: "Source"
	}
];
function SiteHeader() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/",
				className: "flex items-center gap-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "grid size-7 place-items-center rounded-sm border border-border bg-bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-3 rounded-full border-2 border-accent" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-display text-lg font-medium tracking-tight",
					children: "ReelDrop"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex items-center gap-1",
				children: links.map((link) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: link.to,
					className: "inline-flex h-10 items-center rounded-sm px-3 text-sm text-muted transition-colors duration-150 hover:text-fg",
					activeProps: { className: "text-fg" },
					children: link.label
				}, link.to))
			})]
		})
	});
}
function SiteFooter() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
		className: "border-t border-line",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "ReelDrop · Telegram · yt-dlp · Railway" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Download only media you have the right to keep." })]
		})
	});
}
function PageShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "film-grain",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none fixed inset-y-0 left-0 hidden w-3 film-rail md:block",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none fixed inset-y-0 right-0 hidden w-3 film-rail md:block",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {}),
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
export { cn as n, PageShell as t };
