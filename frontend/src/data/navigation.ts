export interface NavItem {
  label: string;
  to: string;
}

export const primaryNav: NavItem[] = [
  { label: "Layanan", to: "/layanan" },
  { label: "Portofolio", to: "/portofolio" },
  { label: "Proses", to: "/proses" },
  { label: "Tentang", to: "/tentang" },
];

export const contactNav: NavItem = { label: "Mulai konsultasi", to: "/kontak" };

/** Every public, indexable route. Shared by prerendering and tests. */
export const staticRoutes = ["/", "/tentang", "/layanan", "/portofolio", "/proses", "/kontak"];
