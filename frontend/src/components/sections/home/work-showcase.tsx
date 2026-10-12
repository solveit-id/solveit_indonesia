import { useRef } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ProjectCard } from "~/components/portfolio/project-card";
import { useTilt } from "~/hooks/use-tilt";
import { isLiteDevice } from "~/lib/device";
import { motionQueries, useMotion } from "~/lib/motion";
import { getProjects } from "~/services/projects";

/**
 * Selected work. On large screens with motion allowed, vertical scroll pans
 * the row of case studies; everywhere else it is a native, swipeable row.
 */
export function WorkShowcase() {
  const wrap = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const projects = getProjects();

  useTilt(wrap);

  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(`${motionQueries.motion} and ${motionQueries.desktop}`, () => {
        if (isLiteDevice() || !track.current || !wrap.current) return;
        const el = track.current;
        wrap.current.dataset.pan = "true";
        const distance = () => el.scrollWidth - el.clientWidth;
        gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: wrap.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        return () => {
          if (wrap.current) wrap.current.dataset.pan = "false";
        };
      });
    },
    { scope: wrap },
  );

  return (
    <section
      ref={wrap}
      data-pan="false"
      aria-labelledby="work-title"
      className="group/pan relative overflow-hidden bg-paper-sunken py-[var(--spacing-section)] data-[pan=true]:flex data-[pan=true]:min-h-dvh data-[pan=true]:flex-col data-[pan=true]:justify-center data-[pan=true]:py-16"
    >
      <div className="shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="work-title" className="max-w-[17ch] text-title">
            Konsep yang menunjukkan cara kami berpikir.
          </h2>
          <p className="mt-5 measure text-ink-muted">
            Lima studi kasus konsep untuk sektor berbeda. Semuanya ilustratif, bukan proyek klien;
            portofolio klien akan tampil setelah mendapat izin publikasi.
          </p>
        </div>
        <Link to="/portofolio" className="btn btn-secondary shrink-0 self-start md:self-end">
          Lihat portofolio
          <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
        </Link>
      </div>

      <div
        ref={track}
        role="region"
        aria-label="Studi kasus konsep"
        className="mt-12 flex snap-x snap-mandatory scroll-px-[var(--pan-inset)] [scrollbar-width:thin] gap-5 overflow-x-auto px-[var(--pan-inset)] pb-4 [--pan-inset:max(var(--spacing-gutter),calc((100vw-88rem)/2+var(--spacing-gutter)))] group-data-[pan=true]/pan:overflow-visible md:gap-8 lg:mt-14"
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.slug}
            project={project}
            size="large"
            className="w-[min(84vw,24rem)] shrink-0 snap-start md:w-[min(60vw,30rem)] lg:w-[min(40vw,34rem)]"
          />
        ))}
      </div>
    </section>
  );
}
