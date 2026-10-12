// Post-build steps for the static output in build/client:
//  - 404.html from the prerendered /404 page (served by static hosts)
//  - robots.txt, plus sitemap.xml when VITE_SITE_URL is configured
// The sitemap is derived from the prerendered HTML, so it always matches what
// was actually built and skips any page marked noindex.
import { copyFile, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { loadEnv } from "vite";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const outDir = join(root, "build", "client");
const env = loadEnv(process.env.NODE_ENV ?? "production", root, "VITE_");
const siteUrl = (process.env.VITE_SITE_URL ?? env.VITE_SITE_URL ?? "").trim().replace(/\/+$/, "");

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name === "index.html") yield full;
  }
}

// 1. 404 page
const notFoundDir = join(outDir, "404");
await copyFile(join(notFoundDir, "index.html"), join(outDir, "404.html"));
await rm(notFoundDir, { recursive: true, force: true });

// 2. Indexable routes
const routes = [];
for await (const file of htmlFiles(outDir)) {
  const html = await readFile(file, "utf8");
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
  const rel = relative(outDir, file).split(sep).join("/");
  const path = rel === "index.html" ? "/" : `/${rel.replace(/\/index\.html$/, "")}`;
  routes.push({ path, lastmod: (await stat(file)).mtime.toISOString().slice(0, 10) });
}
routes.sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)));

// 3. robots.txt and sitemap.xml
const robots = ["User-agent: *", "Allow: /", ""];
if (siteUrl) {
  const urls = routes
    .map(
      ({ path, lastmod }) =>
        `  <url>\n    <loc>${siteUrl}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    )
    .join("\n");
  await writeFile(
    join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  robots.push(`Sitemap: ${siteUrl}/sitemap.xml`, "");
} else {
  console.warn("[postbuild] VITE_SITE_URL is not set: sitemap.xml and canonical URLs are skipped.");
}
await writeFile(join(outDir, "robots.txt"), robots.join("\n"));

console.log(
  `[postbuild] ${routes.length} indexable pages${siteUrl ? `, sitemap for ${siteUrl}` : ""}.`,
);
