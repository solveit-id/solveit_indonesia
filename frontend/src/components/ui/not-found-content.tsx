import { Link } from "react-router";
import { BrandMark } from "~/components/brand/brand-mark";
import { sitemapNav } from "~/data/navigation";
import { useI18n } from "~/i18n";

/** Shared by the 404 routes and unknown portfolio slugs, in the URL's language. */
export function NotFoundContent() {
  const { t, path } = useI18n();
  const links = sitemapNav.filter((key) => key !== "contact");
  return (
    <section className="shell grid min-h-[100dvh] items-center gap-14 pt-[calc(var(--header-h)+3rem)] pb-24 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="enter text-lg font-semibold text-accent-text [--enter-index:0]">
          {t.notFound.eyebrow}
        </p>
        <h1 className="enter enter-solid mt-4 max-w-[14ch] text-display font-wide">
          {t.notFound.title}
        </h1>
        <p className="enter mt-6 measure text-lede text-ink-muted [--enter-index:2]">
          {t.notFound.text}
        </p>
        <nav aria-label={t.notFound.navLabel} className="enter mt-10 [--enter-index:3]">
          <ul className="flex flex-wrap gap-2">
            {links.map((key) => (
              <li key={key}>
                <Link to={path(key)} className="btn btn-secondary min-h-11">
                  {t.nav.labels[key]}
                </Link>
              </li>
            ))}
            <li>
              <Link to={path("contact")} className="btn btn-primary min-h-11">
                {t.common.consult}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto w-[min(60vw,18rem)] lg:col-span-4 lg:col-start-9 lg:w-full">
        {/* One piece has slipped out of place: the mark is incomplete, like the URL. */}
        <BrandMark className="w-full [&_[data-capsule='3']]:translate-x-[70px] [&_[data-capsule='3']]:translate-y-[46px] [&_[data-capsule='3']]:opacity-35" />
      </div>
    </section>
  );
}
