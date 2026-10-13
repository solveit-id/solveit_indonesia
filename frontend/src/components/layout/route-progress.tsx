import { useNavigation } from "react-router";
import { CapsuleLoader } from "~/components/feedback/capsule-loader";
import { useDelayedFlag } from "~/hooks/use-delayed-flag";
import { useI18n } from "~/i18n";

/** A navigation slower than this also gets a visible, announced status. */
const SLOW_MS = 900;

/**
 * Route loading feedback, scaled to how long the wait really is:
 * - under ~150ms: nothing (the page simply changes);
 * - longer: a thin cobalt runner along the top edge, indeterminate, because
 *   the router cannot know how far a chunk download has got;
 * - beyond ~900ms: a small branded status chip (the capsules assembling) and
 *   a polite screen reader announcement.
 * First load never shows any of it: every page arrives as complete HTML.
 */
export function RouteProgress() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const busy = navigation.state !== "idle";
  const slow = useDelayedFlag(busy, SLOW_MS);
  const state = busy ? "busy" : "idle";

  return (
    <>
      <div aria-hidden data-state={state} className="route-bar">
        <span className="route-bar-runner" />
      </div>
      <div aria-hidden data-state={slow ? "busy" : "idle"} className="route-chip">
        <CapsuleLoader className="w-3.5 text-accent-text" />
        <span>{t.loading.page}</span>
      </div>
      <p role="status" className="sr-only">
        {slow ? t.loading.page : ""}
      </p>
    </>
  );
}
