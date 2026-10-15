import { type ReactNode, useRef } from "react";
import { useI18n } from "~/i18n";
import { motionQueries, useMotion } from "~/lib/motion";
import { getEcosystem } from "~/services/content";
import type { EcosystemPart, EcosystemStatus } from "~/types/content";

/** Status as text plus a capsule glyph: filled, half, or hollow and dashed. */
function StatusChip({ status, label }: { status: EcosystemStatus; label: string }) {
  return (
    <span className="eco-status" data-status={status}>
      <span aria-hidden className="eco-status-glyph" />
      {label}
    </span>
  );
}

/*
 * The ecosystem as one connected map, read top to bottom: this website (the
 * foundation, in progress), the internal hub being designed, then the
 * client-facing parts, still plans. A spine joins the three tiers; it fills
 * with the reader's scroll and each tier's marker lights as the fill reaches
 * it, and both run back when scrolling up. Every card is readable without
 * JavaScript and under reduced motion (spine full, markers lit).
 */
export function EcosystemRoadmap({ intro }: { intro: ReactNode }) {
  const { t, locale } = useI18n();
  const copy = t.about;
  const scope = useRef<HTMLDivElement>(null);
  const parts = getEcosystem(locale);
  const tiers = (["foundation", "hub", "module"] as const).map((tier) => ({
    tier,
    parts: parts.filter((part) => part.tier === tier),
  }));

  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const root = scope.current;
        if (!root) return;
        root.dataset.armed = "true";
        gsap.fromTo(
          "[data-eco-fill]",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top 70%", end: "bottom 70%", scrub: 0.4 },
          },
        );
        for (const tier of gsap.utils.toArray<HTMLElement>("[data-eco-tier]")) {
          ScrollTrigger.create({
            trigger: tier,
            start: "top 70%",
            onEnter: () => tier.classList.add("is-passed"),
            onLeaveBack: () => tier.classList.remove("is-passed"),
          });
        }
        // Planned modules settle in order the first time, then stay.
        gsap.from("[data-eco-module]", {
          opacity: 0,
          y: 16,
          stagger: 0.07,
          duration: 0.7,
          ease: "expo.out",
          scrollTrigger: { trigger: "[data-eco-modules]", start: "top 85%", once: true },
        });
        return () => {
          root.dataset.armed = "false";
          for (const tier of root.querySelectorAll(".is-passed"))
            tier.classList.remove("is-passed");
        };
      });
    },
    { scope },
  );

  const card = (part: EcosystemPart) => (
    <div className="eco-card" data-status={part.status}>
      <StatusChip status={part.status} label={copy.status[part.status]} />
      <h4 className="eco-name">{part.name}</h4>
      <p className="eco-role">{part.role}</p>
    </div>
  );

  return (
    <div ref={scope} className="eco" data-armed="false">
      <div className="eco-intro">
        {intro}
        <p className="eco-orbit">
          <span aria-hidden className="eco-orbit-glyph" />
          <span className="font-bold text-ink">{copy.roadmapOrbit}</span>
          <span className="text-ink-muted">{copy.roadmapOrbitRole}</span>
        </p>
        <p className="max-w-[60ch] text-[0.95rem] text-ink-muted">{copy.roadmapNote}</p>
      </div>
      <div className="eco-map">
        <span aria-hidden className="eco-spine" />
        <span aria-hidden data-eco-fill className="eco-spine eco-spine-fill" />
        <ol aria-label={copy.roadmapLabel} className="eco-tiers">
          {tiers.map(({ tier, parts: members }) => (
            <li key={tier} data-eco-tier className="eco-tier" data-tier={tier}>
              <span aria-hidden className="eco-marker" data-status={members[0]?.status} />
              <h3 className="eco-tier-title">{copy.roadmapTiers[tier]}</h3>
              {tier === "module" ? (
                <ul data-eco-modules className="eco-modules">
                  {members.map((part) => (
                    <li key={part.key} data-eco-module>
                      {card(part)}
                    </li>
                  ))}
                </ul>
              ) : (
                members.map((part) => <div key={part.key}>{card(part)}</div>)
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
