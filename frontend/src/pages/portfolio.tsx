import { useRef, useState } from "react";
import { ProjectCard } from "~/components/portfolio/project-card";
import { PageIntro } from "~/components/ui/page-intro";
import { projectCategories } from "~/data/projects";
import { useTilt } from "~/hooks/use-tilt";
import { cn } from "~/lib/cn";
import { getGsap, motionQueries, useMotion } from "~/lib/motion";
import { buildMeta } from "~/lib/seo";
import { getProjects } from "~/services/projects";
import type { ProjectCategory } from "~/types/content";
import type { Route } from "./+types/portfolio";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: "Portofolio dan Studi Kasus",
    description:
      "Studi kasus konsep Solveit Indonesia untuk website, aplikasi web, sistem informasi, dan custom software di berbagai sektor.",
    path: "/portofolio",
    breadcrumbs: [{ name: "Portofolio", path: "/portofolio" }],
  });

type Filter = ProjectCategory | "semua";

export default function Portfolio() {
  const scope = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const [filter, setFilter] = useState<Filter>("semua");
  const all = getProjects();
  const visible = filter === "semua" ? all : getProjects(filter);

  useTilt(scope);

  // Reflow the grid smoothly when the filter changes.
  useMotion(
    ({ gsap, Flip }) => {
      const state = flipState.current;
      flipState.current = null;
      if (!state) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        Flip.from(state, {
          targets: "[data-flip-item]",
          duration: 0.7,
          ease: "expo.out",
          absolute: true,
          onEnter: (elements) =>
            gsap.fromTo(elements, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }),
          onLeave: (elements) => gsap.to(elements, { autoAlpha: 0, duration: 0.3 }),
        });
      });
    },
    { scope: grid, dependencies: [filter] },
  );

  const choose = (next: Filter) => {
    if (next === filter) return;
    if (grid.current)
      flipState.current =
        getGsap()?.Flip.getState(grid.current.querySelectorAll("[data-flip-item]")) ?? null;
    setFilter(next);
  };

  const options: { id: Filter; label: string }[] = [
    { id: "semua", label: "Semua" },
    ...projectCategories,
  ];

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: "Portofolio" }]}
        title="Portofolio dan studi kasus."
        lede={
          <p>
            Halaman ini memuat studi kasus konsep yang menunjukkan cara Solveit Indonesia memetakan
            masalah, merancang solusi, dan memilih teknologi. Semua proyek di bawah adalah konsep
            demonstrasi, bukan pekerjaan untuk klien, dan akan digantikan oleh portofolio klien
            setelah mendapat izin publikasi.
          </p>
        }
      />

      <section aria-labelledby="portfolio-list" className="shell pb-[var(--spacing-section)]">
        <h2 id="portfolio-list" className="sr-only">
          Daftar studi kasus
        </h2>
        <div role="group" aria-label="Saring berdasarkan kategori" className="flex flex-wrap gap-2">
          {options.map((option) => {
            const count = option.id === "semua" ? all.length : getProjects(option.id).length;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => choose(option.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.95rem] font-medium transition-colors",
                  filter === option.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line-strong hover:border-ink",
                )}
              >
                {option.label}
                <span className="text-sm opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          Menampilkan {visible.length} studi kasus.
        </p>

        {visible.length === 0 ? (
          <div className="mt-14 rounded-[var(--radius-panel)] border border-dashed border-line-strong p-10 text-center">
            <p className="text-lede">Belum ada studi kasus untuk kategori ini.</p>
            <button
              type="button"
              className="btn btn-secondary mt-6"
              onClick={() => choose("semua")}
            >
              Tampilkan semua
            </button>
          </div>
        ) : (
          <ul ref={grid} className="mt-12 grid gap-x-8 gap-y-16 md:grid-cols-2 lg:mt-16">
            {visible.map((project, index) => (
              <li
                key={project.slug}
                data-flip-item
                data-flip-id={project.slug}
                className={cn(
                  index === 0 && "md:col-span-2",
                  index > 0 && index % 2 === 0 && "md:translate-y-24",
                )}
              >
                <ProjectCard project={project} size="large" headingLevel="h3" lead={index === 0} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
