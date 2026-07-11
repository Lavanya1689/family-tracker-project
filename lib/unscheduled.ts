import { supabaseAdmin } from "./supabase";
import type { Item } from "./types";

// Items added to the calendar (status "scheduled") that never got a date —
// either Gemini found no temporal signal in the source email, or the email
// genuinely doesn't state one (e.g. an Evite link with the date behind the
// link, not in the email text). Without a surface to show these, "Add to
// calendar" on a dateless item silently made it disappear everywhere.
export async function getUnscheduledItems(): Promise<Item[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("items")
    .select("*")
    .eq("status", "scheduled")
    .is("starts_at", null)
    .is("due_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as Item[];
}
