// Renders the raster brand assets in public/ from the original logo SVGs:
// Open Graph image (1200x630), apple-touch-icon (180), favicon-32, icon-512.
// Run after changing the logo or the OG layout: `node scripts/generate-brand-assets.mjs`.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = join(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const publicDir = join(root, "public");
const icon = await readFile(join(publicDir, "brand", "logo-solveit-icon.svg"), "utf8");
const primary = await readFile(join(publicDir, "brand", "logo-solveit-primary.svg"), "utf8");
const font = await readFile(
  join(root, "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"),
);
const fontFace = `@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");font-weight:100 900;font-stretch:62% 125%}`;

const iconPage = (size, padding, background) => `<!doctype html><html><head><style>
  html,body{margin:0;width:${size}px;height:${size}px;background:${background}}
  body{display:grid;place-items:center}
  svg{width:${size - padding * 2}px;height:${size - padding * 2}px}
</style></head><body>${icon}</body></html>`;

const ogPage = `<!doctype html><html><head><style>
  ${fontFace}
  html,body{margin:0;width:1200px;height:630px}
  body{background:#f1f4f9;font-family:Archivo,sans-serif;color:#082a56;position:relative;overflow:hidden}
  .logo{position:absolute;left:84px;top:72px;width:300px}
  .logo svg{width:100%;height:auto;display:block}
  h1{position:absolute;left:84px;bottom:150px;margin:0;width:760px;font-size:62px;line-height:1.02;font-stretch:115%;font-weight:760;letter-spacing:-0.03em}
  h1 span{color:#1146d8}
  p{position:absolute;left:84px;bottom:78px;margin:0;font-size:24px;color:#4a6283;font-weight:500}
  .mark{position:absolute;right:-40px;top:70px;width:420px;opacity:1}
  .mark svg{width:100%;height:auto;display:block}
</style></head><body>
  <div class="logo">${primary}</div>
  <div class="mark">${icon}</div>
  <h1>Solusi digital yang dibangun untuk <span>bertahan.</span></h1>
  <p>Website, aplikasi web, sistem informasi, dan custom software</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

const shoot = async (html, width, height, file) => {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(publicDir, file), omitBackground: false });
  console.log(`wrote public/${file}`);
};

await shoot(ogPage, 1200, 630, "og/solveit-og.png");
await shoot(iconPage(180, 26, "#f1f4f9"), 180, 180, "apple-touch-icon.png");
await shoot(iconPage(512, 72, "#f1f4f9"), 512, 512, "icon-512.png");
await shoot(iconPage(32, 2, "transparent"), 32, 32, "favicon-32.png");

await browser.close();
