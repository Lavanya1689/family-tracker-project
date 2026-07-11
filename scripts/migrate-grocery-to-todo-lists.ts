// One-time migration: copies existing grocery_items rows into the new
// generic todo_lists/todo_items tables under a seeded "Grocery" list, so
// nothing already on the list is lost when the Lists page switches over.
// Safe to re-run: skips if a "Grocery" list already exists.
import { supabaseAdmin } from "../lib/supabase";

async function main() {
  const db = supabaseAdmin();

  const { data: existing, error: existingError } = await db
    .from("todo_lists")
    .select("id")
    .eq("name", "Grocery")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    console.log(`"Grocery" list already exists (${existing.id}) — skipping migration.`);
    return;
  }

  const { data: groceryItems, error: groceryError } = await db
    .from("grocery_items")
    .select("*")
    .order("created_at", { ascending: true });
  if (groceryError) throw groceryError;

  if (!groceryItems || groceryItems.length === 0) {
    console.log("No grocery_items to migrate.");
    return;
  }

  const { data: list, error: listError } = await db
    .from("todo_lists")
    .insert({ name: "Grocery", sort_order: 0 })
    .select()
    .single();
  if (listError) throw listError;

  const { error: itemsError } = await db.from("todo_items").insert(
    groceryItems.map((item) => ({
      list_id: list.id,
      name: item.name,
      done: item.done,
      added_by: item.added_by,
      created_at: item.created_at,
    }))
  );
  if (itemsError) throw itemsError;

  console.log(`Migrated ${groceryItems.length} grocery item(s) into list "${list.name}" (${list.id}).`);
}

main();
