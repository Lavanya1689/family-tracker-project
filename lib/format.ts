import { dayDiffInTz, formatTimeInTz, formatDateInTz } from "./timezone";

const KIND_FALLBACK_LABEL: Record<string, string> = {
  event: "Upcoming",
  deadline: "Needs attention",
  action_item: "Action needed",
};

export function formatDueLabel(
  dueAt: string | null,
  kind: string = "action_item",
  now: Date = new Date()
): string {
  if (!dueAt) return KIND_FALLBACK_LABEL[kind] ?? "Needs attention";

  const diffDays = dayDiffInTz(new Date(dueAt), now);

  if (diffDays < 0) return "Past due";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${formatDateInTz(dueAt)}`;
}

export function formatTime(dateTime: string): string {
  return formatTimeInTz(dateTime);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Plain "YYYY-MM-DD" dates (e.g. task due dates) have no time component, so
// there's no timezone to convert — parsing through `new Date()` would read
// it as UTC midnight and can roll it back a day once localized. Format the
// string directly instead.
export function formatPlainDate(isoDate: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, month, day] = match;
  return `${MONTH_ABBR[Number(month) - 1]} ${Number(day)}`;
}

export function formatTodayLabel(now: Date = new Date()): string {
  const weekday = formatDateInTz(now, undefined, { weekday: "short" });
  const date = formatDateInTz(now);
  return `Today · ${weekday}, ${date}`;
}
