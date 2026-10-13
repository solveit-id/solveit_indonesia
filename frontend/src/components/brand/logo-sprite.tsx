import { primaryCapsules, primaryDescriptor, primaryWordmark } from "./logo-paths";

/**
 * Ids of the primary lockup's parts, defined once per document by
 * <LogoSprite /> and drawn with <use>. The load overlay, the header, and the
 * footer all show the lockup; sharing one definition keeps the path data
 * (about 9 KB) out of every page three times over.
 */
export const logoPart = {
  capsule: (index: number) => `solveit-capsule-${index}`,
  gradient: (index: number) => `solveit-gradient-${index}`,
  word: "solveit-word",
  descriptor: "solveit-descriptor",
} as const;

/**
 * Hidden definitions for the primary lockup (original paths and gradients,
 * unaltered). Zero-sized rather than display: none, because gradients inside
 * an undisplayed SVG do not paint in every engine.
 */
export function LogoSprite() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {primaryCapsules.map(({ d, gradient }, index) => (
          <g key={index}>
            <linearGradient
              id={logoPart.gradient(index)}
              x1={gradient.x1}
              y1={gradient.y1}
              x2={gradient.x2}
              y2={gradient.y2}
              gradientUnits="userSpaceOnUse"
            >
              {gradient.stops.map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
            </linearGradient>
            <path id={logoPart.capsule(index)} d={d} />
          </g>
        ))}
        <path id={logoPart.word} d={primaryWordmark} />
        <path id={logoPart.descriptor} d={primaryDescriptor} />
      </defs>
    </svg>
  );
}

/** One capsule of the primary lockup, in its gradient or a flat colour. */
export function LogoCapsule({ index, mono = false }: { index: number; mono?: boolean }) {
  return (
    <use
      href={`#${logoPart.capsule(index)}`}
      fill={mono ? "currentColor" : `url(#${logoPart.gradient(index)})`}
    />
  );
}
