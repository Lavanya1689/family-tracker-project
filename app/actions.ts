"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { localToUtcIso } from "@/lib/timezone";

// Moves an item from "needs attention" onto the calendar: status becomes
// "scheduled" (same status ICS-sourced events already use), which both
// drops it off the Today view's attention list and keeps it in the
// published ICS feed the phone subscribes to (the feed excludes only
// "handled" items). Extraction (lib/gemini.ts) is instructed to infer a
// sensible due_at from context whenever the email implies one, so this no
// longer guesses a date itself — forcing every dateless item onto today's
// calendar was misleading (most weren't actually due today). An item with
// truly no date just leaves the attention list without landing on a
// specific calendar day.
export async function addToCalendar(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update({ status: "scheduled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/week");
}

// Dismisses an item permanently: reuses "handled", which is already
// excluded from the Today view's attention list, the today/week timelines,
// and the published ICS feed everywhere. Since the source email is never
// reprocessed (dedup ledger), the exact same item can't resurface later —
// marking one item handled has no bearing on any future email's extraction,
// even a similar-looking one, since each is extracted independently.
// dismissal_reason records *why*, for the handled-items log on Lists.
export async function ignoreItem(formData: FormData) {
  await dismissItem(formData, "ignored");
}

export async function markDone(formData: FormData) {
  await dismissItem(formData, "done");
}

async function dismissItem(formData: FormData, reason: "ignored" | "done") {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update({ status: "handled", dismissal_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/lists");
}

// Reverses a mistaken dismissal from the Handled log — back to needing
// attention, as if it were freshly extracted.
export async function undoHandled(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update({ status: "needs_attention", dismissal_reason: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/lists");
}

// Gives a date to an item that has none (see the Unscheduled section on the
// Schedule page) — an all-day due_at, since we only have a date, not a time.
export async function scheduleOnDate(formData: FormData) {
  const id = formData.get("id");
  const date = formData.get("date");
  if (typeof id !== "string") return;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update({
      due_at: localToUtcIso(`${date}T00:00:00`),
      all_day: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/schedule");
}

export async function toggleTodoItem(formData: FormData) {
  const id = formData.get("id");
  const done = formData.get("done") === "true";
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db.from("todo_items").update({ done: !done }).eq("id", id);
  if (error) throw error;
  revalidatePath("/lists");
}

export async function addTodoItem(formData: FormData) {
  const listId = formData.get("list_id");
  const name = formData.get("name");
  const addedBy = formData.get("added_by");
  if (typeof listId !== "string") return;
  if (typeof name !== "string" || name.trim().length === 0) return;

  const db = supabaseAdmin();
  const { error } = await db.from("todo_items").insert({
    list_id: listId,
    name: name.trim(),
    added_by: typeof addedBy === "string" && addedBy.length > 0 ? addedBy : null,
  });
  if (error) throw error;
  revalidatePath("/lists");
}

export async function deleteTodoItem(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db.from("todo_items").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/lists");
}

export async function createTodoList(formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length === 0) return;

  const db = supabaseAdmin();
  const { count } = await db.from("todo_lists").select("*", { count: "exact", head: true });
  const { error } = await db.from("todo_lists").insert({
    name: name.trim(),
    sort_order: count ?? 0,
  });
  if (error) throw error;
  revalidatePath("/lists");
}

// Deletes the list and everything in it (todo_items cascade on list_id).
// No confirmation dialog here — the button itself asks plainly ("Delete
// list") rather than hiding behind a generic icon, so a stray click is less
// likely; a full undo system for lists felt like overkill for phase 1.
export async function deleteTodoList(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db.from("todo_lists").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/lists");
}

export async function toggleTask(formData: FormData) {
  const id = formData.get("id");
  const done = formData.get("done") === "true";
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db.from("tasks").update({ done: !done }).eq("id", id);
  if (error) throw error;
  revalidatePath("/lists");
}

export async function addTask(formData: FormData) {
  const title = formData.get("title");
  const ownerName = formData.get("owner_name");
  const dueDate = formData.get("due_date");
  const priority = formData.get("priority");
  if (typeof title !== "string" || title.trim().length === 0) return;
  if (typeof ownerName !== "string" || ownerName.trim().length === 0) return;

  const db = supabaseAdmin();
  const { error } = await db.from("tasks").insert({
    title: title.trim(),
    owner_name: ownerName.trim(),
    due_date: typeof dueDate === "string" && dueDate.length > 0 ? dueDate : null,
    priority: typeof priority === "string" && priority.length > 0 ? priority : null,
  });
  if (error) throw error;
  revalidatePath("/lists");
}

export async function deleteTask(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/lists");
}

export async function addReminder(formData: FormData) {
  const title = formData.get("title");
  const subtitle = formData.get("subtitle");
  const remindAt = formData.get("remind_at");
  if (typeof title !== "string" || title.trim().length === 0) return;
  if (typeof remindAt !== "string" || remindAt.length === 0) return;

  const db = supabaseAdmin();
  const { error } = await db.from("reminders").insert({
    title: title.trim(),
    subtitle: typeof subtitle === "string" && subtitle.trim().length > 0 ? subtitle.trim() : null,
    remind_at: new Date(remindAt).toISOString(),
  });
  if (error) throw error;
  revalidatePath("/lists");
}

export async function deleteReminder(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db.from("reminders").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/lists");
}

export async function updateGeminiInstructions(formData: FormData) {
  const instructions = formData.get("instructions");
  if (typeof instructions !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("app_settings")
    .update({
      gemini_custom_instructions: instructions.trim().length > 0 ? instructions.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw error;
  revalidatePath("/settings");
}
