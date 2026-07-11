import { supabaseAdmin } from "./supabase";

export async function getGeminiCustomInstructions(): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("app_settings")
    .select("gemini_custom_instructions")
    .eq("id", true)
    .maybeSingle();
  return data?.gemini_custom_instructions ?? null;
}
