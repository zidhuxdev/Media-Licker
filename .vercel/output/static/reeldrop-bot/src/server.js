import http from "node:http";
import { log } from "./logger.js";

export function createServer({ config, bot }) {
  return http.createServer(async (req, res) => {
    const url = req.url || "/";
    if (req.method === "GET" && (url === "/" || url === "/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "reeldrop-bot",
          uptime: Math.round(process.uptime()),
        }),
      );
      return;
    }

    if (req.method === "POST" && url === "/telegram") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      try {
        const update = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        await bot.handleUpdate(update);
        res.writeHead(200);
        res.end("ok");
      } catch (err) {
        log("error", "webhook", { err: err.message });
        res.writeHead(500);
        res.end("error");
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });
}
