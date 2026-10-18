import { describe, expect, it } from "vitest";
import { revalidatePrivateArea } from "./router";

const at = (path: string) => new URL(path, "http://127.0.0.1:5174");

describe("when the private area asks GET me again", () => {
  it.each([
    ["/", "/pengguna"],
    ["/pengguna", "/pengguna/2"],
    ["/pengguna?peran=admin", "/undangan?peran=admin"],
    ["/audit", "/audit"],
    ["/pengguna?peran=admin", "/pengguna?peran=admin"],
  ])("from %s to %s: yes", (from, to) => {
    expect(revalidatePrivateArea({ currentUrl: at(from), nextUrl: at(to) })).toBe(true);
  });

  it.each([
    ["/pengguna", "/pengguna?peran=admin"],
    ["/audit?tindakan=logout", "/audit"],
  ])("a filter change alone, %s to %s: no", (from, to) => {
    expect(revalidatePrivateArea({ currentUrl: at(from), nextUrl: at(to) })).toBe(false);
  });
});
