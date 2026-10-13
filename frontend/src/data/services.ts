import type { ServiceId } from "~/types/content";

/** Display order of the services. Copy per language: `src/data/locales/<locale>/services.ts`. */
export const serviceIds: ServiceId[] = [
  "website",
  "aplikasi-web",
  "sistem-informasi",
  "custom-software",
  "dukungan-teknis",
];

export const isServiceId = (value: string | null | undefined): value is ServiceId =>
  serviceIds.some((id) => id === value);
