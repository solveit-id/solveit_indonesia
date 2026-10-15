// Post-build steps for the static output in build/client:
//  - 404.html and en/404.html from the prerendered /404 and /en/404 pages
//    (static hosts serve the nearest 404.html; see docs/development/development-guide.md)
//  - robots.txt, plus sitemap.xml when VITE_SITE_URL is configured
// The sitemap is derived from the prerendered HTML, so it always matches what
// was actually built: it skips any page marked noindex and lists each page's
// hreflang alternates exactly as the page declares them.
import { copyFile, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { loadEnv } from "vite";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const outDir = join(root, process.env.BUILD_DIR || "build", "client");
const env = loadEnv(process.env.NODE_ENV ?? "production", root, "VITE_");
const siteUrl = (process.env.VITE_SITE_URL ?? env.VITE_SITE_URL ?? "").trim().replace(/\/+$/, "");

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name === "index.html") yield full;
  }
}

// 1. 404 pages, one per language
for (const prefix of ["", "en"]) {
  const notFoundDir = join(outDir, prefix, "404");
  await copyFile(join(notFoundDir, "index.html"), join(outDir, prefix, "404.html"));
  await rm(notFoundDir, { recursive: true, force: true });
}

// 2. Critical rendering path. Every page is complete static HTML, and the app
// only enhances it: hydration already waits for first paint
// (src/entry.client.tsx). React Router's output would still start ~20 module
// downloads while the HTML is parsed, competing with the stylesheet and the
// font that paint actually needs. So the bootstrap is moved behind first
// paint: the module preloads and the inline module script are re-inserted,
// unchanged, once the browser reports that content is on screen. Links, the hero form, and
// <details> menus work as plain HTML in the meantime.
for await (const file of htmlFiles(outDir)) await deferBootstrap(file);
for (const file of ["404.html", "en/404.html", "__spa-fallback.html"])
  await deferBootstrap(join(outDir, file));

async function deferBootstrap(file) {
  let html = await readFile(file, "utf8");
  const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"\/>/g)].map(
    ([, href]) => href,
  );
  const module = html.match(/<script type="module" async="">([\s\S]*?)<\/script>/);
  if (!module || preloads.length === 0)
    throw new Error(`[postbuild] unexpected bootstrap in ${file}`);
  // JSON in an inline script: escape "<" so the code can never close the tag.
  const json = (value) => JSON.stringify(value).replace(/</g, "\u003c");
  // Starts once the browser reports first contentful paint (the page is on
  // screen), or after 3 s if no paint is reported (e.g. a background tab).
  const loader =
    `(function(){var started=false;function start(){if(started)return;started=true;var d=document;` +
    `${json(preloads)}.forEach(function(u){var l=d.createElement("link");l.rel="modulepreload";l.href=u;d.head.appendChild(l)});` +
    `var s=d.createElement("script");s.type="module";s.textContent=${json(module[1])};d.body.appendChild(s)}` +
    `try{new PerformanceObserver(function(list){if(list.getEntriesByName("first-contentful-paint").length)setTimeout(start)}).observe({type:"paint",buffered:true})}catch(e){}` +
    `setTimeout(start,3000)})()`;
  html = html.replace(/<link rel="modulepreload" href="[^"]+"\/>/g, "");
  html = html.replace(module[0], () => `<script>${loader}</script>`);
  await writeFile(file, html);
}

// 3. Indexable routes
const routes = [];
for await (const file of htmlFiles(outDir)) {
  const html = await readFile(file, "utf8");
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
  const rel = relative(outDir, file).split(sep).join("/");
  const path = rel === "index.html" ? "/" : `/${rel.replace(/\/index\.html$/, "")}`;
  const alternates = [
    ...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"\/?>/gi),
  ].map(([, lang, href]) => ({ lang, href }));
  routes.push({
    path,
    alternates,
    lastmod: (await stat(file)).mtime.toISOString().slice(0, 10),
  });
}
routes.sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)));

// 4. robots.txt and sitemap.xml
const robots = ["User-agent: *", "Allow: /", ""];
if (siteUrl) {
  const urls = routes
    .map(({ path, lastmod, alternates }) =>
      [
        "  <url>",
        `    <loc>${siteUrl}${path}</loc>`,
        ...alternates.map(
          ({ lang, href }) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`,
        ),
        `    <lastmod>${lastmod}</lastmod>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n");
  await writeFile(
    join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
  );
  robots.push(`Sitemap: ${siteUrl}/sitemap.xml`, "");
} else {
  console.warn("[postbuild] VITE_SITE_URL is not set: sitemap.xml and canonical URLs are skipped.");
}
await writeFile(join(outDir, "robots.txt"), robots.join("\n"));

console.log(
  `[postbuild] ${routes.length} indexable pages${siteUrl ? `, sitemap for ${siteUrl}` : ""}.`,
);
