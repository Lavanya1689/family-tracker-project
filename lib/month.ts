import { supabaseAdmin } from "./supabase";
import { startOfMonthUtc, addMonthsUtc, startOfWeekUtc, addDaysUtc, localMidnightUtc } from "./timezone";
import type { Item, Kid } from "./types";

export interface MonthDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  items: Item[];
}

export interface MonthData {
  monthStart: Date;
  weeks: MonthDay[][];
  kids: Kid[];
}

// A full month grid padded to complete Monday-Sunday weeks (leading days
// from the previous month, trailing days from the next), matching how
// Google Calendar's month view pads its grid.
export async function getMonthData(referenceDate: Date = new Date()): Promise<MonthData> {
  const db = supabaseAdmin();

  const monthStart = startOfMonthUtc(referenceDate);
  const monthEnd = addMonthsUtc(monthStart, 1); // exclusive
  const gridStart = startOfWeekUtc(monthStart);
  const today = localMidnightUtc(0);

  const gridDays: Date[] = [];
  let cursor = gridStart;
  while (cursor.getTime() < monthEnd.getTime() || gridDays.length % 7 !== 0) {
    gridDays.push(cursor);
    cursor = addDaysUtc(cursor, 1);
  }
  const gridEnd = cursor;

  const [{ data: kids }, { data: items }] = await Promise.all([
    db.from("kids").select("*"),
    db
      .from("items")
      .select("*")
      .neq("status", "handled")
      .or(
        `and(starts_at.gte.${gridStart.toISOString()},starts_at.lt.${gridEnd.toISOString()}),` +
          `and(due_at.gte.${gridStart.toISOString()},due_at.lt.${gridEnd.toISOString()})`
      )
      .order("starts_at", { ascending: true }),
  ]);

  const monthDays: MonthDay[] = gridDays.map((date) => {
    const nextDate = addDaysUtc(date, 1);
    const dayItems = (items ?? []).filter((item) => {
      const anchor = item.starts_at ?? item.due_at;
      if (!anchor) return false;
      const anchorDate = new Date(anchor);
      return anchorDate >= date && anchorDate < nextDate;
    }) as Item[];

    return {
      date,
      inCurrentMonth: date.getTime() >= monthStart.getTime() && date.getTime() < monthEnd.getTime(),
      isToday: date.getTime() === today.getTime(),
      items: dayItems,
    };
  });

  const weeks: MonthDay[][] = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return { monthStart, weeks, kids: (kids ?? []) as Kid[] };
}
