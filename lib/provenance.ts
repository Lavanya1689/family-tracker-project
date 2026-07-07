// Builds the human-readable source line every extracted item must carry,
// e.g. "From Brightwheel email · Tuesday" — see CLAUDE.md's provenance rule.

export function senderDisplayName(fromHeader: string): string {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<.+>$/);
  const name = match ? match[1].trim() : fromHeader.split("@")[0];
  // Common sender headers look like "Brightwheel <no-reply@mail.brightwheel.com>"
  return name.replace(/\s*\(.*\)$/, "");
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000
  );

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function gmailProvenance(sender: string, receivedAt: Date): string {
  return `From ${senderDisplayName(sender)} email · ${formatDayLabel(receivedAt)}`;
}

export function icsProvenance(feedName: string): string {
  return `From ${feedName} calendar`;
}
