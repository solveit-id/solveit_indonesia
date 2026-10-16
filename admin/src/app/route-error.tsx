import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "~/components/ui/button";
import { useI18n } from "~/i18n/i18n";
import { paths } from "~/routes/paths";

/**
 * Error boundary inside the shell: navigation stays usable. It shows what happened in plain
 * words and the HTTP status of a route response, never a stack trace, message, or request
 * data, in any build.
 */
export function RouteError() {
  const { t } = useI18n();
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : null;

  return (
    <article className="max-w-[60ch]">
      <h1 className="text-page font-wide">{t.error.title}</h1>
      <p className="mt-4 text-[1.0625rem] text-ink-muted">
        {t.error.body}
        {status === null ? null : ` (${status})`}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          variant="primary"
          icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
          onClick={() => window.location.reload()}
        >
          {t.error.reload}
        </Button>
        <Link to={paths.foundation} className="btn btn-secondary">
          <ArrowLeft aria-hidden size={18} weight="bold" />
          {t.error.back}
        </Link>
      </div>
    </article>
  );
}

/** Last resort when the shell itself fails: no router context, plain markup. */
export function RootError() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[60ch] content-center gap-4 px-6">
      <h1 className="text-page font-wide">Konsol admin gagal dimuat</h1>
      <p className="text-ink-muted" lang="en">
        The admin console failed to load. Reload the page.
      </p>
    </main>
  );
}

/** Shown while the first route module loads. */
export function ShellFallback() {
  return <div className="min-h-dvh bg-paper" aria-hidden />;
}
