/**
 * Calendar days as the owner means them. `GET audit-events` takes ISO 8601 instants and Laravel
 * reads a bare date as midnight UTC, so "18 October" sent as `2026-10-18` would start at 07:00
 * in Jakarta and drop the rest of the day from an `occurred_to`. A day is therefore sent as
 * its first and last moment in this device's time zone, with the offset written out.
 */
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** True for a real calendar date written as YYYY-MM-DD (no 31 February). */
export function isCalendarDay(value: string | null | undefined): value is string {
  const match = DAY.exec(value ?? "");

  if (match === null) {
    return false;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** `2026-10-18T00:00:00+07:00` or `2026-10-18T23:59:59.999+07:00` for this device's zone. */
export function dayBoundary(value: string, edge: "start" | "end"): string | undefined {
  if (!isCalendarDay(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date =
    edge === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  // Offset of that moment (a day can change offset at a DST switch elsewhere in the world).
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const offset = `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
  const time = edge === "start" ? "00:00:00" : "23:59:59.999";

  return `${value}T${time}${offset}`;
}

/** The YYYY-MM-DD key of an instant in this device's time zone (for grouping by day). */
export function localDayKey(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? "unknown"
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
