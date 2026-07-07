"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export async function markHandled(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update({ status: "handled", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/");
}
