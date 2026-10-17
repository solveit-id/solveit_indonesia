import { describe, expect, it, vi } from "vitest";
import {
  type AccessLinkWindow,
  holdAccessLinkToken,
  peekHeldAccessLinkToken,
  releaseHeldAccessLinkToken,
  takeAccessLinkToken,
} from "./access-link";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

function windowAt(url: string) {
  const location = new URL(url);
  const replaceState = vi.fn((_state: unknown, _unused: string, next: string) => {
    const updated = new URL(next, location);
    location.hash = updated.hash;
    location.search = updated.search;
    location.pathname = updated.pathname;
  });

  return {
    win: { location, history: { state: { idx: 3 }, replaceState } } as unknown as AccessLinkWindow,
    location,
    replaceState,
  };
}

describe("takeAccessLinkToken", () => {
  it("reads a valid token from the fragment and removes the fragment at once", () => {
    expect(TOKEN).toHaveLength(43);
    const { win, location, replaceState } = windowAt(`https://admin.example/access#token=${TOKEN}`);

    expect(takeAccessLinkToken(win)).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledWith({ idx: 3 }, "", "/access");
    expect(location.href).toBe("https://admin.example/access");
  });

  it("keeps the query string but never reads a token from it", () => {
    const { win, replaceState } = windowAt(`https://admin.example/access?lang=en&token=${TOKEN}`);

    expect(takeAccessLinkToken(win)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it.each(["#token=short", "#token=" + TOKEN + "x", "#token=" + "!".repeat(43), "#other=1"])(
    "removes %s too, but returns nothing",
    (fragment) => {
      const { win, location } = windowAt(`https://admin.example/access?lang=en${fragment}`);

      expect(takeAccessLinkToken(win)).toBeNull();
      expect(location.hash).toBe("");
      expect(location.search).toBe("?lang=en");
    },
  );

  it("does nothing without a fragment", () => {
    const { win, replaceState } = windowAt("https://admin.example/access");

    expect(takeAccessLinkToken(win)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("stores the token nowhere", () => {
    const { win } = windowAt(`https://admin.example/access#token=${TOKEN}`);

    takeAccessLinkToken(win);

    expect(JSON.stringify({ ...localStorage })).not.toContain(TOKEN);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(TOKEN);
    expect(document.cookie).not.toContain(TOKEN);
  });
});

describe("holding the token from start-up", () => {
  it("takes the token out of the address before the router starts, on /access only", () => {
    const { win, location } = windowAt(`https://admin.example/access#token=${TOKEN}`);

    holdAccessLinkToken(win, "/access");

    expect(location.hash).toBe("");
    expect(peekHeldAccessLinkToken()).toBe(TOKEN);
    releaseHeldAccessLinkToken();
    expect(peekHeldAccessLinkToken()).toBeNull();
  });

  it("removes a token fragment elsewhere too, but never holds it", () => {
    const { win, location } = windowAt(`https://admin.example/akun#token=${TOKEN}`);

    holdAccessLinkToken(win, "/access");

    expect(location.hash).toBe("");
    expect(peekHeldAccessLinkToken()).toBeNull();
  });

  it("leaves other fragments alone", () => {
    const { win, replaceState } = windowAt("https://admin.example/akun#main");

    holdAccessLinkToken(win, "/access");

    expect(replaceState).not.toHaveBeenCalled();
  });
});
