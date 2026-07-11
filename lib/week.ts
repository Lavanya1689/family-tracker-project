import { supabaseAdmin } from "./supabase";
import { startOfWeekUtc, addDaysUtc, localMidnightUtc } from "./timezone";
import type { Item, Kid } from "./types";

export interface WeekDay {
  date: Date;
  isToday: boolean;
  items: Item[];
}

export interface WeekData {
  weekStart: Date;
  days: WeekDay[];
  kids: Kid[];
}

// A real Monday-Sunday calendar week containing `referenceDate` (defaults
// to the current week) — navigable via referenceDate, matching how a
// normal calendar app's week view works, rather than a rolling 7-day
// window from today. Includes both scheduled events and anything with a
// due_at landing on that day, so deadlines show up flagged alongside the
// day's events.
export async function getWeekData(referenceDate: Date = new Date()): Promise<WeekData> {
  const db = supabaseAdmin();

  const weekStart = startOfWeekUtc(referenceDate);
  const weekEnd = addDaysUtc(weekStart, 7);
  const today = localMidnightUtc(0);

  const [{ data: kids }, { data: items }] = await Promise.all([
    db.from("kids").select("*"),
    db
      .from("items")
      .select("*")
      .neq("status", "handled")
      .or(
        `and(starts_at.gte.${weekStart.toISOString()},starts_at.lt.${weekEnd.toISOString()}),` +
          `and(due_at.gte.${weekStart.toISOString()},due_at.lt.${weekEnd.toISOString()})`
      )
      .order("starts_at", { ascending: true }),
  ]);

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysUtc(weekStart, i);
    const nextDate = addDaysUtc(weekStart, i + 1);

    const dayItems = (items ?? []).filter((item) => {
      const anchor = item.starts_at ?? item.due_at;
      if (!anchor) return false;
      const anchorDate = new Date(anchor);
      return anchorDate >= date && anchorDate < nextDate;
    }) as Item[];

    days.push({ date, isToday: date.getTime() === today.getTime(), items: dayItems });
  }

  return { weekStart, days, kids: (kids ?? []) as Kid[] };
}
