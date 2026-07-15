import { supabaseAdmin } from "./supabase";
import type { Kid } from "./types";

export async function getKidsByHousehold(householdId: string): Promise<Kid[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("kids")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Kid[];
}

// Cycles through the 4 marker-pen color slots in order added — the first
// kid gets 'a', second 'b', and so on, wrapping if a household somehow
// has more than 4 (colors repeat rather than erroring; a real 5th-color
// slot is a rare enough case not worth blocking on for now).
const COLOR_ORDER = ["a", "b", "c", "d"] as const;

export async function createKid(
  householdId: string,
  name: string,
  context: string | null
): Promise<void> {
  const db = supabaseAdmin();
  const { count } = await db
    .from("kids")
    .select("*", { count: "exact", head: true })
    .eq("household_id", householdId);
  const colorKey = COLOR_ORDER[(count ?? 0) % COLOR_ORDER.length];

  const { error } = await db
    .from("kids")
    .insert({ household_id: householdId, name, color_key: colorKey, context });
  if (error) throw error;
}

export async function deleteKid(householdId: string, id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("kids").delete().eq("id", id).eq("household_id", householdId);
  if (error) throw error;
}
