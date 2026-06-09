#!/usr/bin/env node
/**
 * Local dev server — serves static files + /api/chat
 * Usage: node dev-server.js [port]
 */
import http   from "http";
import fs     from "fs";
import path   from "path";
import url    from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] || "3002", 10);

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
};

// Lazy-import the handler so dotenv runs first
let chatHandler;
async function getHandler() {
  if (!chatHandler) {
    const mod = await import("./api/chat.js");
    chatHandler = mod.default;
  }
  return chatHandler;
}

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API ──────────────────────────────────────────────────────────────────
  if (pathname === "/api/chat") {
    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        req.body = JSON.parse(body || "{}");
      } catch {
        req.body = {};
      }

      // Shim response object for the Vercel handler
      const chunks = [];
      let statusCode = 200;
      const headers  = {};

      const shimRes = {
        status(code)      { statusCode = code; return shimRes; },
        setHeader(k, v)   { headers[k] = v; },
        json(data)        {
          headers["Content-Type"] = "application/json";
          res.writeHead(statusCode, headers);
          res.end(JSON.stringify(data));
        },
        end()             { res.writeHead(statusCode, headers); res.end(); },
      };

      try {
        const handler = await getHandler();
        await handler(req, shimRes);
      } catch (err) {
        console.error("[API error]", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── STATIC FILES ─────────────────────────────────────────────────────────
  let filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  // Default to index.html for unknown paths (SPA-style)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, "index.html");
  }

  const ext     = path.extname(filePath).toLowerCase();
  const mime    = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Kapruka Agent — dev server`);
  console.log(`  http://localhost:${PORT}\n`);
});
