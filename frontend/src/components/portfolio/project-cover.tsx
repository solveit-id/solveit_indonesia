import { useId } from "react";
import { cn } from "~/lib/cn";
import type { CoverPattern, CoverTone, ProjectCover as CoverSpec } from "~/types/content";

/**
 * Generative cover art built from the logo's capsule at its 33deg angle.
 * Covers are a deliberate series, not screenshots: each concept gets a
 * deterministic composition from its seed, so they never imply real product UI.
 */

const W = 800;
const H = 600;
const ANGLE = -33;

interface Palette {
  ground: string;
  quiet: string;
  quietOpacity: number;
  lit: [string, string];
  accent: string;
}

const palettes: Record<CoverTone, Palette> = {
  cobalt: {
    ground: "#1452ED",
    quiet: "#F4F7FF",
    quietOpacity: 0.2,
    lit: ["#19B8F2", "#F4F7FF"],
    accent: "#F4F7FF",
  },
  deep: {
    ground: "#0A2272",
    quiet: "#6AA6FF",
    quietOpacity: 0.22,
    lit: ["#178BFF", "#19B8F2"],
    accent: "#E9EFFA",
  },
  sky: {
    ground: "#D6E6FF",
    quiet: "#1452ED",
    quietOpacity: 0.16,
    lit: ["#124EDC", "#178BFF"],
    accent: "#082A56",
  },
  ink: {
    ground: "#082A56",
    quiet: "#5C7392",
    quietOpacity: 0.45,
    lit: ["#1452ED", "#19B8F2"],
    accent: "#E9EFFA",
  },
  porcelain: {
    ground: "#E6ECF5",
    quiet: "#082A56",
    quietOpacity: 0.14,
    lit: ["#1136D6", "#178BFF"],
    accent: "#082A56",
  },
};

interface Capsule {
  x: number;
  y: number;
  length: number;
  thickness: number;
  kind: "quiet" | "lit" | "accent" | "outline";
  angle?: number;
}

const random = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const layouts: Record<CoverPattern, (rand: () => number) => Capsule[]> = {
  lattice: (rand) => {
    const items: Capsule[] = [];
    const lit = new Set([
      Math.floor(rand() * 20),
      Math.floor(rand() * 20),
      Math.floor(rand() * 20),
    ]);
    let i = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        items.push({
          x: 110 + col * 190 + (row % 2) * 95,
          y: 70 + row * 115,
          length: 150,
          thickness: 40,
          kind: lit.has(i) ? "lit" : "outline",
        });
        i++;
      }
    }
    return items;
  },
  stack: (rand) =>
    [0, 1, 2, 3].map((index) => ({
      x: 240 + index * 105,
      y: 150 + index * 100,
      length: 330 + rand() * 170,
      thickness: 74,
      kind: index === 1 ? "lit" : index === 3 ? "accent" : "quiet",
    })),
  stair: (rand) =>
    Array.from({ length: 6 }, (_, index) => ({
      x: 120 + index * 112,
      y: 470 - index * 64,
      length: 120 + index * 46 + rand() * 20,
      thickness: 46,
      kind: index === 5 ? "lit" : index === 2 ? "accent" : "quiet",
    })),
  // Short capsules travelling along parallel 33deg lanes: an order moving
  // through steps.
  orbit: (rand) => {
    const items: Capsule[] = [];
    for (let lane = 0; lane < 4; lane++) {
      for (let step = 0; step < 4; step++) {
        const lit = lane === 1 && step === 2;
        items.push({
          x: 40 + step * 230 + lane * 70 + rand() * 30,
          y: 120 + lane * 130 + step * 0,
          length: 110 + ((lane + step) % 3) * 40,
          thickness: 38,
          kind: lit ? "lit" : (lane + step) % 5 === 0 ? "accent" : "quiet",
        });
      }
    }
    return items;
  },
  // Long parallel bands of varying weight, every one on the 33deg axis.
  weave: (rand) =>
    Array.from({ length: 7 }, (_, index) => ({
      x: 80 + index * 120,
      y: 300 + (rand() - 0.5) * 80,
      length: 360 + (index % 3) * 90,
      thickness: index === 3 ? 56 : 28 + (index % 2) * 10,
      kind: index === 3 ? "lit" : index === 5 ? "accent" : index % 2 ? "outline" : "quiet",
    })),
};

interface ProjectCoverProps {
  cover: CoverSpec;
  className?: string;
}

export function ProjectCover({ cover, className }: ProjectCoverProps) {
  const id = useId().replace(/:/g, "");
  const palette = palettes[cover.tone];
  const capsules = layouts[cover.pattern](random(cover.seed));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-lit`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={palette.lit[0]} />
          <stop offset="1" stopColor={palette.lit[1]} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={palette.ground} />
      <g className="cover-drift">
        {capsules.map((capsule, index) => {
          const fill =
            capsule.kind === "lit"
              ? `url(#${id}-lit)`
              : capsule.kind === "accent"
                ? palette.accent
                : capsule.kind === "quiet"
                  ? palette.quiet
                  : "none";
          return (
            <rect
              key={index}
              className={capsule.kind === "lit" ? "cover-lit" : undefined}
              x={capsule.x - capsule.length / 2}
              y={capsule.y - capsule.thickness / 2}
              width={capsule.length}
              height={capsule.thickness}
              rx={capsule.thickness / 2}
              fill={fill}
              fillOpacity={capsule.kind === "quiet" ? palette.quietOpacity : 1}
              stroke={capsule.kind === "outline" ? palette.quiet : undefined}
              strokeOpacity={
                capsule.kind === "outline" ? Math.min(palette.quietOpacity * 2.2, 0.9) : undefined
              }
              strokeWidth={capsule.kind === "outline" ? 2 : undefined}
              transform={`rotate(${capsule.angle ?? ANGLE} ${capsule.x} ${capsule.y})`}
            />
          );
        })}
      </g>
    </svg>
  );
}
