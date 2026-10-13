import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { describeTechnology, type TechnologyRole, technologyRoles } from "~/data/technologies";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { technologyIcons, technologyIconViewBox } from "./technology-icons";

const symbolId = (icon: string) => `tech-${icon.toLowerCase()}`;

/**
 * The marks a page needs, defined once and drawn by every badge with <use>
 * (a case study shows each technology twice: fact sheet and stack). Render
 * it once, before the badges.
 */
export function TechnologySprite({ technologies }: { technologies: readonly string[] }) {
  const icons = [...new Set(technologies.map((name) => describeTechnology(name).icon))].filter(
    (icon) => icon !== undefined,
  );
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {icons.map((icon) => (
          <path key={icon} id={symbolId(icon)} d={technologyIcons[icon]} />
        ))}
      </defs>
    </svg>
  );
}

/** Brand mark in the current text colour, or a neutral glyph for generic names. */
function TechnologyIcon({ name, className }: { name: string; className?: string }) {
  const { icon } = describeTechnology(name);
  if (!icon) return <PlugsConnected aria-hidden weight="bold" className={className} />;
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={technologyIconViewBox}
      className={className}
      fill="currentColor"
    >
      <use href={`#${symbolId(icon)}`} />
    </svg>
  );
}

/**
 * One technology: its mark in a porcelain well and its name, always written
 * out. Information only, so it is neither a link nor a button and keeps the
 * default cursor; hover just brings the mark forward.
 */
export function TechnologyBadge({
  name,
  size = "default",
}: {
  name: string;
  size?: "default" | "small";
}) {
  return (
    <span className={cn("tech-badge", size === "small" && "tech-badge-small")} data-tech-badge>
      <span className="tech-badge-well">
        <TechnologyIcon name={name} className="tech-badge-icon" />
      </span>
      <span className="tech-badge-name">{name}</span>
    </span>
  );
}

/** Compact row for fact sheets: every technology, in data order. */
export function TechnologyList({ technologies }: { technologies: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {technologies.map((name) => (
        <li key={name}>
          <TechnologyBadge name={name} size="small" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The stack grouped by the layer each part works in (interface, server,
 * integration, data), each layer with a plain-language line for readers who
 * are not engineers. Only layers the project lists are shown.
 */
export function TechnologyStack({ technologies }: { technologies: readonly string[] }) {
  const { t } = useI18n();
  const groups = technologyRoles
    .map((role) => ({
      role,
      names: technologies.filter((name) => describeTechnology(name).role === role),
    }))
    .filter((group): group is { role: TechnologyRole; names: string[] } => group.names.length > 0);

  return (
    <dl className="tech-stack">
      {groups.map(({ role, names }, index) => (
        <div key={role} className="tech-layer" data-tech-layer>
          <dt className="tech-layer-head">
            <span aria-hidden className="tech-layer-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold text-ink">{t.project.technologyRoles[role].name}</span>
            <span className="text-sm text-ink-muted">{t.project.technologyRoles[role].hint}</span>
          </dt>
          <dd>
            <ul className="flex flex-wrap gap-2.5">
              {names.map((name) => (
                <li key={name}>
                  <TechnologyBadge name={name} />
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
