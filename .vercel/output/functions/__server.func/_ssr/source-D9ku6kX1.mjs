import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as cn, t as PageShell } from "./utils-B0ebO2gq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/source-D9ku6kX1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FILES = [
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
	"README.md"
];
function SourcePage() {
	const [active, setActive] = (0, import_react.useState)(FILES[0]);
	const [body, setBody] = (0, import_react.useState)("Loading…");
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		fetch(`/reeldrop-bot/${active}`).then((res) => res.ok ? res.text() : Promise.reject(/* @__PURE__ */ new Error("missing"))).then((text) => {
			if (!cancelled) setBody(text);
		}).catch(() => {
			if (!cancelled) setBody("Could not load that file.");
		});
		return () => {
			cancelled = true;
		};
	}, [active]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-6xl px-4 py-10 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl font-medium tracking-tight",
				children: "Source"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 max-w-xl text-sm leading-relaxed text-muted",
				children: [
					"The Railway project, file by file. Premium emoji live in",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "font-mono text-fg",
						children: "src/emoji.js"
					}),
					". Download the zip from the Railway page to deploy it as-is."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-4 lg:grid-cols-[16rem_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex gap-1 overflow-x-auto lg:block lg:overflow-visible",
					children: FILES.map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setActive(file),
							className: cn("h-10 w-full rounded-sm px-3 text-left font-mono text-xs transition-colors", active === file ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg"),
							children: file
						})
					}, file))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "max-h-[70vh] overflow-auto rounded-lg border border-border bg-bg-elevated p-4 font-mono text-xs leading-relaxed text-fg",
					children: body
				})]
			})
		]
	}) });
}
//#endregion
export { SourcePage as component };
