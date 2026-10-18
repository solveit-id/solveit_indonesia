#!/usr/bin/env node
// Checks the production build in admin/dist (run after `npm run build`; CI runs it on every
// change). Fails with a list of findings. What it proves:
// - the HTML carries the production CSP and noindex, with no inline script and no external host;
// - no JavaScript or CSS refers to another origin (only same-origin assets, see the allowlist);
// - the component reference (dev and QA only) is absent: no chunk, route, or copy, and no
//   developer setup hint (the connection check moved there in B3.2b);
// - no source maps ship;
// - the initial JavaScript stays inside the budget of docs/architecture/admin-dashboard.md 8.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { contentSecurityPolicy } from "../security-policy.ts";

// Optional argument: another build directory (used to prove the checks fail on dist-reference).
const dist = process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
const findings = [];
const fail = (message) => findings.push(message);

const INITIAL_JS_BUDGET_GZIP = 150 * 1024;
const CSS_BUDGET_GZIP = 20 * 1024;

// URLs that appear in bundled library code as identifiers or documentation links and are
// never requested by the browser.
const harmlessUrls = [
  /^http:\/\/www\.w3\.org\//,
  /^https:\/\/react\.dev\/errors\//,
  /^https:\/\/reactrouter\.com\//,
  // React Router's base for parsing relative paths (`new URL(path, "http://localhost")`), also
  // used by src/auth/return-to.ts.
  /^http:\/\/localhost$/,
  // A polyfill suggestion inside React Router's useSearchParams error message.
  /^https:\/\/github\.com\/ungap\/url-search-params\.?$/,
  // Tailwind's licence comment at the top of the CSS.
  /^https:\/\/tailwindcss\.com$/,
  // Text of GSAP's "target not found" warning (switched off in src/lib/gsap.ts); never fetched.
  /^https:\/\/gsap\.com$/,
];

const decodeEntities = (value) =>
  value.replaceAll("&#39;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const all = files(dist);
const rel = (path) => relative(dist, path).replaceAll("\\", "/");
const html = readFileSync(join(dist, "index.html"), "utf8");

// HTML policy.
const cspMeta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
if (!cspMeta) fail("index.html: no Content-Security-Policy meta");
else if (decodeEntities(cspMeta[1]) !== contentSecurityPolicy)
  fail("index.html: CSP differs from security-policy.ts");
if (/unsafe-inline|unsafe-eval/.test(html))
  fail("index.html: unsafe-inline or unsafe-eval present");
if (!/<meta name="robots" content="noindex, nofollow"/.test(html)) fail("index.html: no noindex");
if (!/<meta name="referrer" content="same-origin"/.test(html)) fail("index.html: referrer policy");
for (const tag of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/\bsrc="/.test(tag[1])) fail("index.html: inline <script> present");
  if (tag[2].trim() !== "") fail("index.html: <script> with inline content");
}
for (const url of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!url[1].startsWith("/")) fail(`index.html: non-root-relative URL ${url[1]}`);
}
if (!all.some((path) => rel(path) === "theme-init.js")) fail("theme-init.js missing from dist");

// No other origins in code, and no reference page.
for (const path of all) {
  const name = rel(path);

  if (name.endsWith(".map")) fail(`source map shipped: ${name}`);
  if (/component-reference/.test(name)) fail(`component reference chunk in production: ${name}`);
  if (!/\.(js|css|html)$/.test(name)) continue;

  const text = readFileSync(path, "utf8");

  for (const match of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (!harmlessUrls.some((pattern) => pattern.test(match[0]))) {
      fail(`${name}: external URL ${match[0]}`);
    }
  }

  if (/referensi-komponen|Komponen dasar konsol/.test(text)) {
    fail(`${name}: component reference route or copy in production`);
  }

  // Developer setup hints (the connection check) belong to the reference page only.
  if (/php artisan serve|SOLVEIT_ADMIN_API_TARGET|ADMIN_URL di backend/.test(text)) {
    fail(`${name}: developer setup hints in production`);
  }
}

// Budgets: the entry script and its modulepreloads are the initial JavaScript.
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
  (match) => match[1],
);
const gz = (name) => gzipSync(readFileSync(join(dist, name))).length;
const initialJs = initial.reduce((sum, name) => sum + gz(name), 0);
const css = all
  .filter((path) => path.endsWith(".css"))
  .reduce((sum, path) => sum + gz(rel(path)), 0);

if (initial.length === 0) fail("index.html: no entry script found");
if (initialJs > INITIAL_JS_BUDGET_GZIP) fail(`initial JS ${initialJs} B gzip over budget`);
if (css > CSS_BUDGET_GZIP) fail(`CSS ${css} B gzip over budget`);

console.log(
  `initial JS: ${(initialJs / 1024).toFixed(1)} KB gzip (budget 150 KB), ${initial.join(", ")}`,
);
console.log(`CSS: ${(css / 1024).toFixed(1)} KB gzip (budget 20 KB)`);
console.log(`files: ${all.length}`);

if (findings.length > 0) {
  console.error(`\n${findings.length} finding(s):\n- ${findings.join("\n- ")}`);
  process.exit(1);
}

console.log("admin build checks passed");
