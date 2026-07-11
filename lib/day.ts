import { supabaseAdmin } from "./supabase";
import { addDaysUtc } from "./timezone";
import type { Item, Kid } from "./types";

export interface DayData {
  date: Date;
  items: Item[];
  kids: Kid[];
}

// A single day's items (events + anything due that day), navigable to any
// date — the detail view behind the Day tab of the Schedule screen.
export async function getDayData(date: Date): Promise<DayData> {
  const db = supabaseAdmin();
  const nextDate = addDaysUtc(date, 1);

  const [{ data: kids }, { data: items }] = await Promise.all([
    db.from("kids").select("*"),
    db
      .from("items")
      .select("*")
      .neq("status", "handled")
      .or(
        `and(starts_at.gte.${date.toISOString()},starts_at.lt.${nextDate.toISOString()}),` +
          `and(due_at.gte.${date.toISOString()},due_at.lt.${nextDate.toISOString()})`
      )
      .order("starts_at", { ascending: true }),
  ]);

  return { date, items: (items ?? []) as Item[], kids: (kids ?? []) as Kid[] };
}
