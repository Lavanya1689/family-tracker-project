import { supabaseAdmin } from "./supabase";
import type { Item, Kid } from "./types";

export interface TodayData {
  kids: Kid[];
  needsAttention: Item[];
  todayEvents: Item[];
  emailsReadRecently: number;
}

export async function getTodayData(): Promise<TodayData> {
  const db = supabaseAdmin();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [{ data: kids }, { data: needsAttention }, { data: todayEvents }, { count: emailsReadRecently }] =
    await Promise.all([
      db.from("kids").select("*"),
      db
        .from("items")
        .select("*")
        .eq("status", "needs_attention")
        .order("due_at", { ascending: true, nullsFirst: false }),
      db
        .from("items")
        .select("*")
        .neq("status", "handled")
        .gte("starts_at", startOfToday.toISOString())
        .lt("starts_at", startOfTomorrow.toISOString())
        .order("starts_at", { ascending: true }),
      db
        .from("gmail_messages")
        .select("*", { count: "exact", head: true })
        .gte("processed_at", since24h.toISOString()),
    ]);

  return {
    kids: (kids ?? []) as Kid[],
    needsAttention: (needsAttention ?? []) as Item[],
    todayEvents: (todayEvents ?? []) as Item[],
    emailsReadRecently: emailsReadRecently ?? 0,
  };
}
