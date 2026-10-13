import type { CSSProperties } from "react";
import { primaryCapsules, primaryViewBox } from "./logo-paths";
import { LogoCapsule, logoPart } from "./logo-sprite";

// Each capsule arrives along the logo's 33deg axis, alternating sides, by this
// many hundredths of the lockup's width (see .boot-capsule in app.css).
const ARRIVAL = [15, -18, 19, -16];

/**
 * Fullscreen load overlay: the four capsules of the primary logo assemble,
 * the wordmark slides out of the mark, then the sheet wipes away along the
 * 33deg axis. Static markup animated by CSS only, so it plays on first paint;
 * <html data-boot> (src/lib/boot.ts) moves it through its states.
 *
 * Every layer is its own <svg> with the original viewBox, stacked in one box,
 * so the pieces move as composited layers while the resting state is the
 * exact logo. The inline `display: none` keeps it out of the way if the
 * stylesheet never loads; CSS shows it only while <html data-boot> is set. Decorative throughout: the
 * page underneath is already complete and in the accessibility tree.
 */
export function BootLoader() {
  return (
    <div className="boot-loader" aria-hidden style={{ display: "none" }}>
      <span className="boot-sheet boot-sheet-accent" />
      <span className="boot-sheet" />
      <div className="boot-stage">
        <div className="boot-lockup">
          {primaryCapsules.map((_, index) => (
            <svg
              key={index}
              viewBox={primaryViewBox}
              className="boot-layer boot-capsule"
              style={
                {
                  "--i": index,
                  "--d": ARRIVAL[index],
                } as CSSProperties
              }
              focusable="false"
            >
              <LogoCapsule index={index} />
            </svg>
          ))}
          <div className="boot-clip boot-clip-word">
            <svg viewBox={primaryViewBox} className="boot-layer boot-word" focusable="false">
              <use href={`#${logoPart.word}`} fill="var(--logo-word)" />
            </svg>
          </div>
          <div className="boot-clip boot-clip-desc">
            <svg viewBox={primaryViewBox} className="boot-layer boot-desc" focusable="false">
              <use href={`#${logoPart.descriptor}`} fill="var(--logo-sub)" />
            </svg>
          </div>
        </div>
        <span className="boot-wait" />
      </div>
    </div>
  );
}
