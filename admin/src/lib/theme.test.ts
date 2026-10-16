import { afterEach, describe, expect, it, vi } from "vitest";
import { preferenceKeys } from "./preferences";
import { getTheme, setTheme } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("is light by default and does not follow the OS", () => {
    expect(getTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("stores only the chosen theme, under its preference key", () => {
    setTheme("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect({ ...localStorage }).toEqual({ [preferenceKeys.theme]: "dark" });

    setTheme("light");

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(preferenceKeys.theme)).toBe("light");
  });

  it("still switches when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => setTheme("dark")).not.toThrow();
    expect(getTheme()).toBe("dark");
  });
});
