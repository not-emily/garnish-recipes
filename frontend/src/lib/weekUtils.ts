/**
 * Date helpers for meal planning. All weeks are Monday-start to match
 * the backend's canonical week boundary.
 *
 * We intentionally avoid a heavy dependency (date-fns, dayjs) — the whole
 * surface we need is a few pure functions on ISO date strings.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the Monday of the week containing the given date, as an ISO date
// string (YYYY-MM-DD). Accepts either a Date or ISO string.
export function weekStartOf(date: Date | string): string {
  const d = typeof date === "string" ? parseIsoDate(date) : new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const offset = (day + 6) % 7; // days since Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - offset);
  return toIsoDate(monday);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function addWeeks(isoDate: string, weeks: number): string {
  return addDays(isoDate, weeks * 7);
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

// Returns the seven ISO date strings for the week starting on `weekStart`.
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// "2026-04-06" → "Mon, Apr 6"
export function formatShortDate(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "2026-04-06" → "Apr 6"
export function formatMonthDay(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "2026-04-06" → "Monday"
export function formatWeekdayLong(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, { weekday: "long" });
}

// "2026-04-06" → "Mon"
export function formatWeekdayShort(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, { weekday: "short" });
}

// Format a week range: "Apr 6 – 12, 2026"
export function formatWeekRange(weekStart: string): string {
  const start = parseIsoDate(weekStart);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const sameMonth = start.getMonth() === end.getMonth();
  const year = end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = sameMonth
    ? end.toLocaleDateString(undefined, { day: "numeric" })
    : end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}, ${year}`;
}

// --- internals ---------------------------------------------------------

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Parses an ISO date string (YYYY-MM-DD) as a LOCAL date — not UTC.
// `new Date("2026-04-06")` uses UTC, which can shift the day depending on
// the user's timezone. We want the literal calendar day the user entered.
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
