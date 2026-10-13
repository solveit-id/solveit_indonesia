/*
 * Branded load sequence ("Four capsules. One solution.").
 *
 * The overlay is static markup (src/components/brand/boot-loader.tsx) driven
 * by CSS, so it shows on the very first paint, long before React or GSAP. A
 * few lines in the head boot script (root.tsx) move it through three states
 * on <html data-boot>:
 *
 *   intro  the capsules assemble and the wordmark slides out of the mark
 *   exit   the stage lifts away and the sheet wipes off along the 33deg axis
 *   done   the overlay is gone (display: none)
 *
 * Two lengths (<html data-boot-mode>): the first load in a browser tab plays
 * the full sequence (about 1.3 s); later loads in the same tab (refresh,
 * hard reload) play a short one (about 0.6 s). A tab session is remembered
 * in sessionStorage; if storage is unavailable every load counts as first.
 *
 * Exit starts as soon as the fourth capsule has locked AND the page is ready
 * (DOM parsed, fonts loaded), never later than a cap measured from the first
 * frame of the entrance. Nothing waits for hydration: the JavaScript bundle
 * still starts right after first paint (scripts/postbuild.mjs).
 *
 * Without JavaScript the attribute is never set and the overlay stays hidden.
 * If the stylesheet fails, the overlay's inline `display: none` keeps it out
 * of the way. Reduced motion keeps the moment as a still mark and a short fade.
 */

/** Hold after the entrance when motion is reduced (the mark appears still). */
const REDUCED_HOLD_MS = 420;
/** Longest the overlay may stay up after its entrance starts. */
const CAP_MS = 2600;
/** Safety net if no animation ever starts (e.g. the stylesheet never applies). */
const HARD_CAP_MS = 6000;
/** Exit length (sheet wipe), then the overlay leaves the render tree. */
const EXIT_MS = 640;
const EXIT_SHORT_MS = 360;
const EXIT_REDUCED_MS = 320;
/** sessionStorage key marking that this tab has seen the full sequence. */
export const BOOT_SEEN_KEY = "solveit-boot-seen";

/**
 * Head script fragment. Expects `d` (document.documentElement) in scope and
 * runs before first paint. The entrance counts as finished when the fourth
 * capsule's arrival ends (under reduced motion, when the still mark has
 * shown for a moment). Test harnesses can opt out with
 * `window.__solveitBoot = "off"` set from an init script.
 */
export const bootLoaderScript = `if(window.__solveitBoot!=="off"){(function(){var doc=document,reduce=!matchMedia("(prefers-reduced-motion: no-preference)").matches,seen=false,locked=0,entered=false,ready=false,started=false;try{seen=sessionStorage.getItem("${BOOT_SEEN_KEY}")==="1";sessionStorage.setItem("${BOOT_SEEN_KEY}","1")}catch(e){}d.dataset.bootMode=seen?"short":"full";d.dataset.boot="intro";function exit(){if(d.dataset.boot!=="intro")return;d.dataset.boot="exit";setTimeout(function(){d.dataset.boot="done"},reduce?${EXIT_REDUCED_MS}:seen?${EXIT_SHORT_MS}:${EXIT_MS})}function check(){if(entered&&ready)exit()}function enter(){if(entered)return;entered=true;check()}doc.addEventListener("animationstart",function(e){if(started||e.animationName.indexOf("boot-")!==0)return;started=true;setTimeout(exit,${CAP_MS})},true);doc.addEventListener("animationend",function(e){if(e.animationName==="boot-capsule-in"&&++locked===4)enter();else if(e.animationName==="boot-desc-in"&&reduce)setTimeout(enter,seen?0:${REDUCED_HOLD_MS})},true);function onParsed(){var f=doc.fonts;(f&&f.ready?f.ready:Promise.resolve()).then(function(){ready=true;check()})}if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",onParsed);else onParsed();setTimeout(exit,${HARD_CAP_MS})})()}`;

/**
 * Resolves once the load overlay has started to leave (or immediately if it
 * never showed), so first-view entrances can play where they can be seen.
 */
export const bootSettled = (): Promise<void> =>
  new Promise((resolve) => {
    const root = document.documentElement;
    if (root.dataset.boot !== "intro") return resolve();
    const observer = new MutationObserver(() => {
      if (root.dataset.boot === "intro") return;
      observer.disconnect();
      resolve();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-boot"] });
  });
