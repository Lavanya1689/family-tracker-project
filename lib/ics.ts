import * as ical from "node-ical";
import type { Item } from "./types";

export interface ParsedIcsEvent {
  uid: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
}

// Parses an external ICS feed (school district, activity, work calendar).
export async function parseIcsFeed(url: string): Promise<ParsedIcsEvent[]> {
  const parsed = await ical.async.fromURL(url);

  const events: ParsedIcsEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const entry = parsed[key];
    if (!entry || entry.type !== "VEVENT" || !entry.uid || !entry.start) continue;

    // node-ical marks whole-day values with a `dateOnly` flag on the Date object.
    const allDay = Boolean((entry.start as any).dateOnly);

    events.push({
      uid: entry.uid,
      title: entry.summary?.toString() ?? "(untitled event)",
      description: entry.description ? entry.description.toString() : null,
      startsAt: entry.start,
      endsAt: entry.end ?? null,
      allDay,
    });
  }
  return events;
}

function formatIcsDate(date: Date, allDay: boolean): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

// Builds the ICS feed Nestly publishes for parents to subscribe to in
// Apple/Google Calendar. Every item becomes one VEVENT with its provenance
// folded into the description, matching the "always show the source" rule.
export function generateIcsFeed(items: Item[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nestly//Family Calendar//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Nestly",
  ];

  for (const item of items) {
    const start = item.starts_at ?? item.due_at;
    if (!start) continue; // nothing to put on a calendar without a date

    const startDate = new Date(start);
    const endDate = item.ends_at
      ? new Date(item.ends_at)
      : new Date(startDate.getTime() + 60 * 60 * 1000); // default 1hr block

    const description = [item.description, item.provenance_label]
      .filter(Boolean)
      .join("\\n\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@nestly`,
      `DTSTAMP:${formatIcsDate(new Date(), false)}`,
      item.all_day
        ? `DTSTART;VALUE=DATE:${formatIcsDate(startDate, true)}`
        : `DTSTART:${formatIcsDate(startDate, false)}`,
      item.all_day
        ? `DTEND;VALUE=DATE:${formatIcsDate(endDate, true)}`
        : `DTEND:${formatIcsDate(endDate, false)}`,
      `SUMMARY:${escapeIcsText(item.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
