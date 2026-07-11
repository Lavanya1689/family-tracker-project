import { supabaseAdmin } from "./supabase";
import type { Item } from "./types";

// Recently dismissed items (Done or Ignored) — a visible log with undo,
// so marking something handled is never a one-way door you can't recover
// from if it turns out to matter.
export async function getHandledItems(limit = 30): Promise<Item[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("items")
    .select("*")
    .eq("status", "handled")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Item[];
}
