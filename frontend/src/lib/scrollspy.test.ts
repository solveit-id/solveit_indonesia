import { describe, expect, it } from "vitest";
import { pickChapter, readingLine } from "./scrollspy";

const at = (tops: number[]) => tops.map((top, index) => ({ id: `c${index + 1}`, top }));

describe("scrollspy", () => {
  const view = { line: 300, viewport: 900, atBottom: false };

  it("has no chapter before the first heading reaches the line", () => {
    expect(pickChapter(at([420, 900, 1600]), view)).toBeNull();
  });

  it("picks the last chapter whose top crossed the line, and only one", () => {
    expect(pickChapter(at([-400, 120, 640]), view)).toBe("c2");
    // Exactly on the line counts as reached.
    expect(pickChapter(at([-400, 300, 640]), view)).toBe("c2");
  });

  it("keeps a long chapter current through its body and the gap after it", () => {
    // c1 started far above; c2 has not reached the line yet.
    expect(pickChapter(at([-2400, 301]), view)).toBe("c1");
  });

  it("follows reading order for chapters that share a row", () => {
    // Two chapters at the same height can never both be current.
    expect(pickChapter(at([100, 100, 800]), view)).toBe("c2");
  });

  it("at the bottom of the page lets visible trailing chapters win", () => {
    expect(pickChapter(at([-900, 200, 520, 760]), { ...view, atBottom: true })).toBe("c4");
    // A chapter still below the fold never wins, even at the bottom.
    expect(pickChapter(at([-900, 200, 950]), { ...view, atBottom: true })).toBe("c2");
  });

  it("sets the reading line under the header, above anchored landings", () => {
    const line = readingLine(88, 900);
    expect(line).toBeGreaterThan(88 + 24);
    expect(line).toBeLessThan(900 / 2);
    expect(readingLine(88, 60)).toBe(88);
  });
});
