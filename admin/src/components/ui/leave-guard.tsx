import { useEffect } from "react";
import { useBlocker } from "react-router";
import { Button } from "./button";
import { Dialog } from "./dialog";

/**
 * Keeps a secret that is shown once (recovery codes, an invitation or reset link) from being
 * lost by accident. While `active`: an in-app navigation to another screen asks first
 * (useBlocker and the dialog below), and a reload or closing the tab triggers the browser's own
 * warning (beforeunload). Nothing is stored to make the secret survive: leaving loses it, and
 * the dialog says so.
 */
export function LeaveGuard({
  active,
  title,
  body,
  stayLabel,
  leaveLabel,
}: {
  active: boolean;
  title: string;
  body: string;
  stayLabel: string;
  leaveLabel: string;
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a value to show their prompt; it is never displayed.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  return (
    <Dialog
      open={blocker.state === "blocked"}
      title={title}
      description={body}
      onClose={() => blocker.reset?.()}
      actions={
        <>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            {leaveLabel}
          </Button>
          <Button variant="primary" onClick={() => blocker.reset?.()} data-autofocus>
            {stayLabel}
          </Button>
        </>
      }
    />
  );
}
