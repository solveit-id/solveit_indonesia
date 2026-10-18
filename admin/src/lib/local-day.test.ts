import { describe, expect, it } from "vitest";
import { dayBoundary, isCalendarDay, localDayKey } from "./local-day";

/** The offset this machine's zone has on that day, written like ISO 8601 (+07:00). */
function offsetOn(year: number, month: number, day: number): string {
  const minutes = -new Date(year, month - 1, day, 12).getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0");

  return `${sign}${hours}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
}

describe("local days", () => {
  it.each(["2026-10-18", "2024-02-29", "2026-12-31"])("accepts the real day %s", (value) => {
    expect(isCalendarDay(value)).toBe(true);
  });

  it.each(["2026-02-29", "2026-13-01", "2026-10-32", "18-10-2026", "2026-10-18T00:00", "", null])(
    "refuses %s",
    (value) => {
      expect(isCalendarDay(value)).toBe(false);
      expect(dayBoundary(String(value), "start")).toBeUndefined();
    },
  );

  it("sends the first and last moment of the day in this zone, with its offset", () => {
    const offset = offsetOn(2026, 10, 18);

    expect(dayBoundary("2026-10-18", "start")).toBe(`2026-10-18T00:00:00${offset}`);
    expect(dayBoundary("2026-10-18", "end")).toBe(`2026-10-18T23:59:59.999${offset}`);
  });

  it("brackets exactly the instants of that local day", () => {
    const start = Date.parse(dayBoundary("2026-10-18", "start")!);
    const end = Date.parse(dayBoundary("2026-10-18", "end")!);

    expect(start).toBe(new Date(2026, 9, 18, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 9, 18, 23, 59, 59, 999).getTime());
  });

  it("groups an instant by its local day", () => {
    const instant = new Date(2026, 9, 18, 23, 30).toISOString();

    expect(localDayKey(instant)).toBe("2026-10-18");
    expect(localDayKey("not a date")).toBe("unknown");
  });
});
