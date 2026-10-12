import { Link } from "react-router";
import { BrandMark } from "~/components/brand/brand-mark";
import { contactNav } from "~/data/navigation";

const links = [
  { label: "Beranda", to: "/" },
  { label: "Layanan", to: "/layanan" },
  { label: "Portofolio", to: "/portofolio" },
  { label: "Proses kerja", to: "/proses" },
];

/** Shared by the 404 route and unknown portfolio slugs. */
export function NotFoundContent() {
  return (
    <section className="shell grid min-h-[100dvh] items-center gap-14 pt-[calc(4.5rem+3rem)] pb-24 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="enter text-lg font-semibold text-accent-text [--enter-index:0]">Error 404</p>
        <h1 className="enter mt-4 max-w-[14ch] text-display font-wide [--enter-index:1]">
          Halaman ini tidak ditemukan.
        </h1>
        <p className="enter mt-6 measure text-lede text-ink-muted [--enter-index:2]">
          Tautannya mungkin sudah berubah atau salah ketik. Lanjutkan dari salah satu halaman
          berikut.
        </p>
        <nav aria-label="Halaman utama" className="enter mt-10 [--enter-index:3]">
          <ul className="flex flex-wrap gap-2">
            {links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="btn btn-secondary min-h-11">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to={contactNav.to} className="btn btn-primary min-h-11">
                {contactNav.label}
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
