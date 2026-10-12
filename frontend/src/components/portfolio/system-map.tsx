import type { CSSProperties } from "react";
import { cn } from "~/lib/cn";
import type { Project } from "~/types/content";

/*
 * Concept system map in the logo's language: each part of the solution is a
 * capsule, the parts climb a staircase, and every connector between them runs
 * at exactly 33deg (rise = run * tan 33deg). Column gap 4rem gives a 2.6rem
 * rise; the connector length is 4rem / cos 33deg = 4.77rem.
 */
const RISE_REM = 2.6;

export function SystemMap({ system }: { system: Project["system"] }) {
  const { actors, handoffs } = system;
  const last = actors.length - 1;

  return (
    <figure>
      <ol
        data-system-map
        className="relative grid gap-6 border-l border-line-strong pl-6 lg:grid-cols-4 lg:gap-x-16 lg:gap-y-0 lg:border-l-0 lg:pl-0"
      >
        {actors.map((actor, index) => (
          <li
            key={actor}
            data-system-node
            className="relative lg:[margin-top:calc(var(--step)*var(--rise))]"
            style={
              {
                "--step": String(last - index),
                "--rise": `${RISE_REM}rem`,
              } as CSSProperties
            }
          >
            <span
              className={cn(
                "relative z-10 flex h-14 items-center rounded-full px-5 leading-tight font-semibold",
                index === last
                  ? "bg-accent text-accent-ink"
                  : "border border-line-strong bg-paper-raised text-ink",
              )}
            >
              {actor}
            </span>
            {index < last && (
              <>
                <span
                  aria-hidden
                  className="absolute top-7 left-full hidden h-px w-[4.77rem] origin-left -rotate-[33deg] bg-accent lg:block"
                />
                <span className="mt-3 block pl-5 text-sm text-ink-muted">
                  <span className="sr-only">Mengirim ke {actors[index + 1]}: </span>
                  {handoffs[index]}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
      <figcaption className="mt-10 max-w-[60ch] text-sm text-ink-muted">
        Diagram konsep: bagian-bagian solusi dan data yang berpindah di antaranya. Bukan tangkapan
        layar sistem nyata.
      </figcaption>
    </figure>
  );
}
