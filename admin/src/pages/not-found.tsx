import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { Link } from "react-router";
import { useI18n } from "~/i18n/i18n";
import { paths } from "~/routes/paths";

/** Every address that is not a built screen, including the owner administration (B3.2c). */
export function NotFound() {
  const { t } = useI18n();

  return (
    <article className="max-w-[60ch]">
      <h1 className="text-page font-wide">{t.notFound.title}</h1>
      <p className="mt-4 text-[1.0625rem] text-ink-muted">{t.notFound.body}</p>
      <Link to={paths.home} className="mt-8 btn btn-secondary">
        <ArrowLeft aria-hidden size={18} weight="bold" />
        {t.notFound.back}
      </Link>
    </article>
  );
}
