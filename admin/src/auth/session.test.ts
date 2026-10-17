import { afterEach, describe, expect, it, vi } from "vitest";
import { accountApi } from "~/services/admin-api";
import { json, me, mockAdminApi, sampleAccount, unauthenticated } from "~/test/admin-api";
import {
  getLastContactAt,
  getSessionState,
  markSignedOut,
  markVerified,
  resetSession,
} from "./session";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetSession();
});

describe("session store", () => {
  it("starts unknown and keeps everything in memory only", () => {
    expect(getSessionState()).toEqual({ status: "unknown" });

    markVerified({ account: sampleAccount(), serverClockOffsetMs: 0 });

    expect(getSessionState().status).toBe("signed-in");
    expect(Object.keys({ ...localStorage })).toEqual([]);
    expect(Object.keys({ ...sessionStorage })).toEqual([]);
  });

  it("drops the account at once when Laravel answers 401 to any request", async () => {
    markVerified({ account: sampleAccount(), serverClockOffsetMs: 0 });
    mockAdminApi({ "GET me/sessions": unauthenticated() });

    await expect(accountApi.listSessions()).rejects.toMatchObject({ kind: "unauthenticated" });

    expect(getSessionState()).toEqual({ status: "signed-out", reason: "expired" });
    expect(getLastContactAt()).toBe(0);
  });

  it("counts a response as contact only when it reached a live session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    markVerified({ account: sampleAccount(), serverClockOffsetMs: 0 });
    mockAdminApi({
      "GET me/sessions": [
        json(403, { message: "This action is unauthorized." }),
        json(200, { data: [] }),
      ],
    });

    vi.setSystemTime(2_000_000);
    await expect(accountApi.listSessions()).rejects.toMatchObject({ kind: "forbidden" });
    expect(getLastContactAt()).toBe(1_000_000);

    vi.setSystemTime(3_000_000);
    await accountApi.listSessions();
    expect(getLastContactAt()).toBe(3_000_000);
  });

  it("reads the server clock from the Date header of GET me", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T02:00:00Z"));
    mockAdminApi({
      "GET me": () => {
        const response = me();
        response.headers.set("Date", "Sat, 17 Oct 2026 02:00:30 GMT");

        return response;
      },
    });

    const verified = await accountApi.me();

    expect(verified.serverClockOffsetMs).toBe(30_000);
  });

  it("a sign-out keeps the reason and forgets the account", () => {
    markVerified({ account: sampleAccount(), serverClockOffsetMs: 0 });

    markSignedOut("signed-out");

    expect(getSessionState()).toEqual({ status: "signed-out", reason: "signed-out" });
  });
});
