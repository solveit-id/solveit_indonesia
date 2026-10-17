import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { markVerified, resetSession } from "~/auth/session";
import { I18nProvider } from "~/i18n/i18n";
import { me, mockAdminApi, renderApp, sampleAccount, unauthenticated } from "~/test/admin-api";
import { IdleWarning } from "./idle-warning";

const MINUTE = 60_000;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetSession();
});

/** Signed in at 02:00, absolute limit at 14:00 (server time equals this device's). */
const account = sampleAccount({
  session: {
    signed_in_at: "2026-10-17T02:00:00+00:00",
    absolute_expires_at: "2026-10-17T14:00:00+00:00",
    idle_timeout_minutes: 30,
  },
});

function renderWarning(at: string) {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(new Date(at));
  // The last contact with Laravel is "now".
  markVerified({ account, serverClockOffsetMs: 0 });
  const onExpired = vi.fn();
  const onSignOut = vi.fn();
  render(
    <I18nProvider>
      <IdleWarning account={account} onExpired={onExpired} onSignOut={onSignOut} />
    </I18nProvider>,
  );

  return { onExpired, onSignOut };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("idle warning (WCAG 2.2.1)", () => {
  it("opens five minutes before the expected idle expiry and sends nothing before", async () => {
    const api = mockAdminApi({ "GET me": me(account) });
    renderWarning("2026-10-17T02:00:00Z");

    await advance(24 * MINUTE);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // No request while idle: the console never keeps a session alive by itself.
    expect(api.calls).toHaveLength(0);

    await advance(MINUTE + 1000);
    const dialog = screen.getByRole("alertdialog", { name: "Sesi akan berakhir" });
    expect(dialog).toHaveAccessibleDescription(/Sesi berakhir dalam 4:5\d/);
    expect(screen.getByRole("button", { name: "Tetap masuk" })).toHaveFocus();
  });

  it("'stay signed in' sends exactly one real GET me and closes the warning", async () => {
    const api = mockAdminApi({ "GET me": me(account) });
    renderWarning("2026-10-17T02:00:00Z");
    await advance(25 * MINUTE + 1000);

    fireEvent.click(screen.getByRole("button", { name: "Tetap masuk" }));

    // waitFor cannot tick under fake timers; let the request and the re-render settle.
    await advance(100);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(api.callsTo("GET me")).toHaveLength(1);
  });

  it("hands over to the session check once the expected expiry has passed", async () => {
    mockAdminApi({});
    const { onExpired } = renderWarning("2026-10-17T02:00:00Z");

    await advance(30 * MINUTE);
    expect(onExpired).not.toHaveBeenCalled();
    await advance(10_000);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("announces the 12-hour limit ten minutes ahead, without offering to extend it", async () => {
    mockAdminApi({});
    const { onSignOut } = renderWarning("2026-10-17T13:51:00Z");
    await advance(1000);

    const dialog = screen.getByRole("alertdialog", { name: "Batas sesi 12 jam hampir tercapai" });
    expect(dialog).toHaveAccessibleDescription(/tidak dapat diperpanjang/);
    expect(screen.queryByRole("button", { name: "Tetap masuk" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Keluar sekarang" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("resume check", () => {
  it("asks Laravel again after the tab was hidden for a while, and follows a 401", async () => {
    const api = mockAdminApi({ "GET me": [me(account), unauthenticated()] });
    const router = renderApp("/akun");
    await screen.findByRole("heading", { level: 1, name: "Akun" });

    const start = Date.now();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.spyOn(Date, "now").mockReturnValue(start + 2 * MINUTE);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/masuk"));
    expect(document.body.textContent).not.toContain("owner@example.test");
    expect(api.callsTo("GET me").length).toBeGreaterThanOrEqual(2);
  });

  it("a short switch away does not ask again", async () => {
    const api = mockAdminApi({ "GET me": me(account) });
    renderApp("/akun");
    await screen.findByRole("heading", { level: 1, name: "Akun" });
    const calls = api.callsTo("GET me").length;

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.callsTo("GET me")).toHaveLength(calls);
  });
});
