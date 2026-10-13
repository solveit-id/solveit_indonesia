import { primaryCapsules, primaryViewBox } from "./logo-paths";
import { LogoCapsule, logoPart } from "./logo-sprite";

/**
 * The primary lockup split into three stacked layers (mark, wordmark,
 * INDONESIA), each an <svg> with the original viewBox, so at rest it is the
 * exact logo. When the header condenses, CSS folds the words into the mark
 * and the four capsules alone (the icon) carry the identity; expanding plays
 * the same path back. See `.lockup` in app.css. Shapes are never altered:
 * only whole layers move or are clipped.
 *
 * Decorative: the surrounding link carries the accessible name. `.logo-hit`
 * is the click and focus target, so the condensed logo never leaves a
 * clickable gap where the words were.
 */
export function HeaderLogo() {
  return (
    <span aria-hidden className="lockup">
      <svg viewBox={primaryViewBox} className="lockup-layer lockup-mark" focusable="false">
        {primaryCapsules.map((_, index) => (
          <LogoCapsule key={index} index={index} />
        ))}
      </svg>
      <svg viewBox={primaryViewBox} className="lockup-layer lockup-word" focusable="false">
        <use href={`#${logoPart.word}`} fill="var(--logo-word)" />
      </svg>
      <svg viewBox={primaryViewBox} className="lockup-layer lockup-desc" focusable="false">
        <use href={`#${logoPart.descriptor}`} fill="var(--logo-sub)" />
      </svg>
      <span className="logo-hit" />
    </span>
  );
}
