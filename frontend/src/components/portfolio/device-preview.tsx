import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DesktopTower } from "@phosphor-icons/react/dist/ssr/DesktopTower";
import { DeviceMobile } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { DeviceTablet } from "@phosphor-icons/react/dist/ssr/DeviceTablet";
import { useHydrated } from "~/hooks/use-hydrated";
import { useI18n } from "~/i18n";
import { motionQueries } from "~/lib/motion";
import type { PreviewDevice, Project } from "~/types/content";

/** Representative viewport per device class, in CSS pixels. */
export const previewDevices: Record<PreviewDevice, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const deviceOrder: PreviewDevice[] = ["desktop", "tablet", "mobile"];
const icons = { desktop: DesktopTower, tablet: DeviceTablet, mobile: DeviceMobile };
export const MIN_WIDTH = 320;
export const MAX_WIDTH = 1440;

/** The device class a frame width falls in (the same breakpoints the site uses). */
export const deviceFor = (width: number): PreviewDevice =>
  width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";

/**
 * Scale that fits a `width` x `height` screen into the stage. The screen is
 * laid out at its true width (so container queries see 1280, 768, or 390
 * pixels) and only drawn smaller: never wider than the page, so a real phone
 * never scrolls sideways.
 */
export const fitScale = (width: number, height: number, stageWidth: number, maxHeight: number) =>
  Math.min(1, stageWidth / width, maxHeight / height);

/**
 * Illustrative screen built only from the case study's own narrative: its
 * sector, title, summary, flow, system parts, and features. Wireframe bars
 * stand in for everything else; there are no records, figures, or users.
 * Container queries reflow it by the frame's width, not the page's.
 */
function ConceptScreen({ project }: { project: Project }) {
  return (
    <div className="cs">
      <div className="cs-bar">
        <span className="cs-logo" />
        <span className="cs-brand">{project.title}</span>
        <span className="cs-nav">
          {project.system.actors.map((actor) => (
            <span key={actor} className="cs-nav-item">
              {actor}
            </span>
          ))}
        </span>
        <span className="cs-menu">
          <span />
          <span />
        </span>
      </div>
      <div className="cs-body">
        <div className="cs-side">
          {project.system.actors.map((actor, index) => (
            <span key={actor} className="cs-side-item" data-current={index === 0 || undefined}>
              {actor}
            </span>
          ))}
        </div>
        <div className="cs-main">
          <div className="cs-hero">
            <span className="cs-kicker">{project.sector}</span>
            <span className="cs-heading">{project.summary}</span>
            <span className="cs-lines">
              <span />
              <span />
            </span>
            <span className="cs-cta">{project.flow[0]}</span>
          </div>
          <span className="cs-steps">
            {project.flow.map((step, index) => (
              <span key={step} className="cs-step">
                <span className="cs-step-index">{index + 1}</span>
                <span className="cs-step-name">{step}</span>
              </span>
            ))}
          </span>
          <span className="cs-grid">
            {project.features.map((feature) => (
              <span key={feature.name} className="cs-card">
                <span className="cs-card-mark" />
                <span className="cs-card-name">{feature.name}</span>
                <span className="cs-card-text">{feature.description}</span>
                <span className="cs-lines">
                  <span />
                </span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/*
 * Responsive preview: a segmented device switch, a frame laid out at the
 * chosen width and scaled to fit, a draggable right edge (fine pointers and
 * touch), and a range input that does the same from the keyboard. Switching
 * device animates the frame with a FLIP (transform only); dragging writes at
 * most once per frame. Before hydration the frame simply fills the column.
 */
export function DevicePreview({ project }: { project: Project }) {
  const { t } = useI18n();
  const copy = t.project.preview;
  const hydrated = useHydrated();
  const concept = project.preview.kind === "concept";
  const [width, setWidth] = useState(previewDevices.desktop.width);
  const [stage, setStage] = useState({ width: 0, maxHeight: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const flipFrom = useRef<DOMRect | null>(null);
  const drag = useRef<{ x: number; width: number; scale: number; pending: number; frame: number }>(
    null,
  );

  const device = deviceFor(width);
  const height = previewDevices[device].height;
  const scale = stage.width > 0 ? fitScale(width, height, stage.width, stage.maxHeight) : 1;

  // One observer for the stage; the maximum height follows the viewport.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setStage({
        width: el.clientWidth,
        maxHeight: Math.max(320, Math.min(640, window.innerHeight * 0.62)),
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // FLIP: the frame starts at its previous size and settles into the new one.
  useLayoutEffect(() => {
    const from = flipFrom.current;
    const frame = frameRef.current;
    flipFrom.current = null;
    if (!from || !frame || matchMedia(motionQueries.reduce).matches) return;
    const to = frame.getBoundingClientRect();
    if (to.width === 0 || to.height === 0) return;
    frame.animate(
      [
        {
          transformOrigin: "top center",
          transform: `translateY(${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
        },
        { transformOrigin: "top center", transform: "none" },
      ],
      { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    frame
      .querySelector(".preview-screen")
      ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: "ease-out" });
  }, [width]);

  const choose = (next: PreviewDevice) => {
    const target = previewDevices[next].width;
    if (target === width) return;
    flipFrom.current = frameRef.current?.getBoundingClientRect() ?? null;
    setWidth(target);
  };

  const clamp = (value: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)));

  const onDragStart = (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width, scale, pending: width, frame: 0 };
  };
  const onDragMove = (event: PointerEvent<HTMLSpanElement>) => {
    const state = drag.current;
    if (!state) return;
    // The frame is centred, so its edge moves half as far as its width.
    state.pending = clamp(state.width + ((event.clientX - state.x) * 2) / state.scale);
    if (!state.frame)
      state.frame = requestAnimationFrame(() => {
        state.frame = 0;
        setWidth(state.pending);
      });
  };
  const onDragEnd = () => {
    if (drag.current?.frame) cancelAnimationFrame(drag.current.frame);
    if (drag.current) setWidth(drag.current.pending);
    drag.current = null;
  };
  useEffect(() => () => cancelAnimationFrame(drag.current?.frame ?? 0), []);

  const sized = hydrated && stage.width > 0;
  const percent = Math.round(scale * 100);
  const shot = project.preview.kind === "screenshots" ? project.preview.shots[device] : null;

  return (
    <figure className="preview">
      <div className="preview-controls">
        <fieldset className="preview-switch">
          <legend className="sr-only">{copy.deviceLegend}</legend>
          {deviceOrder.map((key) => {
            const Icon = icons[key];
            return (
              <label key={key} className="preview-option">
                <input
                  type="radio"
                  name={`preview-device-${project.key}`}
                  value={key}
                  checked={device === key}
                  disabled={!hydrated}
                  onChange={() => choose(key)}
                  onClick={() => choose(key)}
                />
                <span>
                  <Icon aria-hidden weight="bold" className="size-4" />
                  {copy.devices[key]}
                </span>
              </label>
            );
          })}
        </fieldset>
        {concept && (
          <label className="preview-range">
            <span className="text-sm font-semibold">{copy.width}</span>
            <input
              type="range"
              min={MIN_WIDTH}
              max={MAX_WIDTH}
              step={10}
              value={width}
              disabled={!hydrated}
              aria-valuetext={copy.pixels(width)}
              onChange={(event) => setWidth(clamp(Number(event.target.value)))}
            />
          </label>
        )}
        <p className="preview-readout">
          <span className="font-semibold text-ink">
            {width} × {height}
          </span>
          {sized && percent < 100 ? ` · ${copy.shown(percent)}` : ""}
        </p>
      </div>

      <div ref={stageRef} className="preview-stage">
        <div
          ref={frameRef}
          className="preview-frame"
          data-device={device}
          style={
            sized ? { width: width * scale, height: height * scale } : { aspectRatio: "16 / 10" }
          }
        >
          <div
            className="preview-screen"
            role="img"
            aria-label={
              shot
                ? copy.shot(project.title, copy.devices[device])
                : copy.screen(project.title, width)
            }
            style={sized ? { width, height, transform: `scale(${scale})` } : undefined}
          >
            {shot ? (
              <img
                src={shot.src}
                width={shot.width}
                height={shot.height}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div aria-hidden className="h-full">
                <ConceptScreen project={project} />
              </div>
            )}
          </div>
          {concept && sized && (
            <span
              aria-hidden
              className="preview-handle"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            />
          )}
        </div>
      </div>

      <figcaption className="preview-caption">
        <span className="preview-label">
          <span aria-hidden className="demo-label-glyph" />
          <span className="demo-label-lead">{concept ? copy.conceptLabel : copy.realLabel}</span>
        </span>
        <span className="max-w-[64ch]">{concept ? copy.conceptNote : copy.realNote}</span>
      </figcaption>
    </figure>
  );
}
