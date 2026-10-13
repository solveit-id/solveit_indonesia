import { NotFoundContent } from "~/components/ui/not-found-content";
import { getMessages, localeFromPath } from "~/i18n";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/not-found";

export const meta: Route.MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale).meta;
  return buildMeta({
    locale,
    title: t.notFoundTitle,
    description: t.notFoundDescription,
    path: location.pathname,
    noindex: true,
  });
};

export default function NotFound() {
  return <NotFoundContent />;
}
