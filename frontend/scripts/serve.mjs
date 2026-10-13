// Minimal static server for build/client that mirrors production hosting:
// clean URLs (/path -> /path/index.html), the nearest 404.html (en/404.html
// for /en/...) with a real 404 status,
// long-lived caching for hashed assets, and brotli/gzip for text like any CDN.
// Used by `npm run preview`, e2e, and Lighthouse runs.
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const root = join(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  "build",
  "client",
);
const port = Number(process.env.PORT ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".data": "text/x-script; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const isFile = async (path) => (await stat(path).catch(() => null))?.isFile() ?? false;

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^[\\/]+/, "");
  if (clean.startsWith("..")) return null;
  const direct = join(root, clean);
  if (await isFile(direct)) return direct;
  const index = join(root, clean, "index.html");
  if (await isFile(index)) return index;
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = await resolve(pathname);
  const target = file ?? join(root, /^\/en(\/|$)/.test(pathname) ? "en/404.html" : "404.html");
  const type = types[extname(target)] ?? "application/octet-stream";
  let body = await readFile(target);
  const headers = {
    "Content-Type": type,
    "Cache-Control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "X-Content-Type-Options": "nosniff",
    Vary: "Accept-Encoding",
  };
  const accept = String(req.headers["accept-encoding"] ?? "");
  if (/^(text|application)\/|image\/svg/.test(type) && body.length > 1024) {
    if (accept.includes("br")) {
      body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } });
      headers["Content-Encoding"] = "br";
    } else if (accept.includes("gzip")) {
      body = gzipSync(body);
      headers["Content-Encoding"] = "gzip";
    }
  }
  res.writeHead(file ? 200 : 404, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}).listen(port, () => console.log(`Serving build/client at http://localhost:${port}`));
