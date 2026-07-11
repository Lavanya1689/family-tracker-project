// Builds the human-readable source line every extracted item must carry,
// e.g. "From Brightwheel email · Tuesday" — see CLAUDE.md's provenance rule.

import { dayDiffInTz, formatDateInTz } from "./timezone";

export function senderDisplayName(fromHeader: string): string {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<.+>$/);
  const name = match ? match[1].trim() : fromHeader.split("@")[0];
  // Common sender headers look like "Brightwheel <no-reply@mail.brightwheel.com>"
  return name.replace(/\s*\(.*\)$/, "");
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const diffDays = dayDiffInTz(now, date);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return formatDateInTz(date, undefined, { weekday: "long" });
  }
  return formatDateInTz(date);
}

export function gmailProvenance(sender: string, receivedAt: Date, accountLabel?: string): string {
  const base = `From ${senderDisplayName(sender)} email · ${formatDayLabel(receivedAt)}`;
  return accountLabel ? `${base} (${accountLabel}'s inbox)` : base;
}

export function icsProvenance(feedName: string): string {
  return `From ${feedName} calendar`;
}
