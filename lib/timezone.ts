// Nestly is single-household and anchored to one real-world timezone
// (APP_TIMEZONE), not the runtime's timezone — which is UTC on Vercel but
// whatever the developer's machine is set to locally. Every "what day is
// this" or "what time does this display as" decision must go through here
// instead of raw `new Date()` / `Date.prototype.getHours()`, or it silently
// breaks the moment this app runs somewhere other than the family's timezone.

function getAppTimeZone(): string {
  return process.env.APP_TIMEZONE || "America/Chicago";
}

// Converts a naive local datetime string (no trailing Z/offset — the
// contract with Gemini's extraction prompt) to the UTC instant it
// represents in the given IANA timezone. Uses the standard
// guess-then-correct technique via Intl so no extra tz-database
// dependency is needed.
export function localToUtcIso(naiveDateTime: string, timeZone: string = getAppTimeZone()): string {
  const stripped = naiveDateTime.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
  const guessUtc = new Date(stripped.includes("T") ? `${stripped}Z` : `${stripped}T00:00:00Z`);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(guessUtc).map((p) => [p.type, p.value]));
  const asIfLocal = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const offset = asIfLocal - guessUtc.getTime();
  return new Date(guessUtc.getTime() - offset).toISOString();
}

// The UTC instant corresponding to local midnight of the calendar day
// `date` falls on, as observed in the given timezone — the timezone-correct
// replacement for `date.setHours(0,0,0,0)`, which uses the server
// runtime's own timezone (UTC on Vercel) instead of the family's.
export function startOfDayUtc(date: Date, timeZone: string = getAppTimeZone()): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return new Date(localToUtcIso(`${parts.year}-${parts.month}-${parts.day}T00:00:00`, timeZone));
}

// The UTC instant corresponding to local midnight, `daysFromToday` days out,
// as observed in the app's timezone — the correct way to compute "today" /
// "this week" boundaries regardless of the server runtime's own timezone.
export function localMidnightUtc(daysFromToday: number, timeZone: string = getAppTimeZone()): Date {
  const today = startOfDayUtc(new Date(), timeZone);
  today.setUTCDate(today.getUTCDate() + daysFromToday);
  return startOfDayUtc(today, timeZone);
}

// Whole calendar-day difference between two instants, as observed in the
// given timezone (e.g. "due tomorrow" vs "due in 3 days").
export function dayDiffInTz(a: Date, b: Date, timeZone: string = getAppTimeZone()): number {
  const startA = startOfDayUtc(a, timeZone).getTime();
  const startB = startOfDayUtc(b, timeZone).getTime();
  return Math.round((startA - startB) / 86_400_000);
}

const WEEKDAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

// Monday 00:00 of the calendar week containing `referenceDate` (defaults to
// now), as observed in the given timezone. Used both to scope "this week"'s
// task tally and to navigate the Week schedule view to arbitrary weeks.
export function startOfWeekUtc(
  referenceDate: Date = new Date(),
  timeZone: string = getAppTimeZone()
): Date {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(referenceDate);
  const offset = WEEKDAY_OFFSET[weekday] ?? 0;
  const start = startOfDayUtc(referenceDate, timeZone);
  start.setUTCDate(start.getUTCDate() - offset);
  return startOfDayUtc(start, timeZone);
}

// Local midnight `days` days after `date`, as observed in the given
// timezone — the general form of localMidnightUtc, for navigating from an
// arbitrary reference point (e.g. paging the Week/Month schedule views)
// rather than always relative to today.
export function addDaysUtc(date: Date, days: number, timeZone: string = getAppTimeZone()): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return startOfDayUtc(shifted, timeZone);
}

// The 1st of the calendar month containing `referenceDate`, as observed in
// the given timezone.
export function startOfMonthUtc(
  referenceDate: Date = new Date(),
  timeZone: string = getAppTimeZone()
): Date {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" });
  const parts = Object.fromEntries(dtf.formatToParts(referenceDate).map((p) => [p.type, p.value]));
  return new Date(localToUtcIso(`${parts.year}-${parts.month}-01T00:00:00`, timeZone));
}

// The 1st of the month `months` away from the month containing `date`
// (negative to go back) — for paging the Month schedule view.
export function addMonthsUtc(date: Date, months: number, timeZone: string = getAppTimeZone()): Date {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  let y = Number(parts.year);
  let m = Number(parts.month) - 1 + months;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return new Date(localToUtcIso(`${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00`, timeZone));
}

// "YYYY-MM-DD" for the calendar day `date` falls on, as observed in the
// given timezone — for building/reading URL date params. Deliberately not
// derived from a locale-formatted string (e.g. via toLocaleDateString +
// reordering "MM/DD/YYYY"): that's exactly the kind of thing that silently
// swaps month and day if the locale's field order isn't what you assumed.
export function toIsoDateInTz(date: Date, timeZone: string = getAppTimeZone()): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Current hour (0-23) in the family's timezone — used to fire the daily
// digest around a fixed local clock time (e.g. 9am) without hand-rolling
// DST-aware UTC-offset math; the cron just checks local hour every 15 min.
export function getLocalHour(date: Date = new Date(), timeZone: string = getAppTimeZone()): number {
  const hourStr = date.toLocaleString("en-US", { timeZone, hour: "numeric", hour12: false });
  return parseInt(hourStr, 10) % 24;
}

export function formatTimeInTz(dateTime: string, timeZone: string = getAppTimeZone()): string {
  const time = new Date(dateTime).toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return time.replace(" AM", "a").replace(" PM", "p").replace(":00", "");
}

export function formatDateInTz(
  dateTime: string | Date,
  timeZone: string = getAppTimeZone(),
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  const date = typeof dateTime === "string" ? new Date(dateTime) : dateTime;
  return date.toLocaleDateString("en-US", { ...options, timeZone });
}
