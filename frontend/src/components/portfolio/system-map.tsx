import type { CSSProperties } from "react";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import type { Project } from "~/types/content";

/*
 * Concept system map in the logo's language: each part of the solution is a
 * capsule, the parts climb a staircase, and every connector between them runs
 * at exactly 33deg (rise = run * tan 33deg). Column gap 4rem gives a 2.6rem
 * rise; the connector length is 4rem / cos 33deg = 4.77rem. Below 1024px the
 * parts stack on a vertical spine.
 *
 * Motion hooks (staged in src/pages/project.tsx, all optional): each part's
 * capsule, the ring that answers when data arrives, the connector with the
 * signal capsule that rides its drawing tip, the handoff label, and the
 * phone spine.
 */
const RISE_REM = 2.6;

export function SystemMap({ system }: { system: Project["system"] }) {
  const { t } = useI18n();
  const { actors, handoffs } = system;
  const last = actors.length - 1;

  return (
    <figure>
      <div className="relative">
        <span
          aria-hidden
          data-system-spine
          className="absolute inset-y-0 left-0 z-10 w-px origin-top bg-accent lg:hidden"
        />
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
              <span className="relative block">
                {index > 0 && <span aria-hidden data-system-ring className="system-ring" />}
                <span
                  data-system-capsule
                  className={cn(
                    "relative z-10 flex h-14 items-center rounded-full px-5 leading-tight font-semibold",
                    index === last
                      ? "bg-accent text-accent-ink"
                      : "border border-line-strong bg-paper-raised text-ink",
                  )}
                >
                  {actor}
                </span>
              </span>
              {index < last && (
                <>
                  <span
                    aria-hidden
                    data-system-link
                    className="absolute top-7 left-full hidden h-px w-[4.77rem] origin-left -rotate-[33deg] bg-accent lg:block"
                  >
                    <span data-system-signal className="system-signal" />
                  </span>
                  <span data-system-handoff className="mt-3 block pl-5 text-sm text-ink-muted">
                    <span className="sr-only">
                      {t.project.systemHandoff(actors[index + 1] ?? "")}
                    </span>
                    {handoffs[index]}
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-10 max-w-[60ch] text-sm text-ink-muted">
        {t.project.systemCaption}
      </figcaption>
    </figure>
  );
}
