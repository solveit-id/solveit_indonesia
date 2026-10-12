import { NotFoundContent } from "~/components/ui/not-found-content";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/not-found";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: "Halaman tidak ditemukan",
    description: "Halaman yang Anda cari tidak tersedia di website Solveit Indonesia.",
    path: "/404",
    noindex: true,
  });

export default function NotFound() {
  return <NotFoundContent />;
}
