import { supabaseAdmin } from "./supabase";
import { sendPushToAll } from "./push";
import { getLocalHour, toIsoDateInTz } from "./timezone";

const DIGEST_HOUR = 9;

// Piggybacks on the existing 15-min reminders cron rather than new
// infrastructure — checks local hour == 9 (DST-safe, no UTC-offset math)
// and a per-household "already sent today" date guard, so of the ~4 cron
// runs that land inside the 9 o'clock hour, only the first one actually
// sends. Returns whether it actually sent, purely so the caller can log it.
export async function sendDailyDigestIfDue(householdId: string): Promise<boolean> {
  const now = new Date();
  if (getLocalHour(now) !== DIGEST_HOUR) return false;

  const today = toIsoDateInTz(now);
  const db = supabaseAdmin();

  const { data: settings, error: settingsError } = await db
    .from("app_settings")
    .select("last_digest_sent_date")
    .eq("household_id", householdId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (settings?.last_digest_sent_date === today) return false;

  const { data: items, error } = await db
    .from("items")
    .select("title")
    .eq("household_id", householdId)
    .eq("status", "needs_attention")
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const titles = (items ?? []).map((i) => i.title);

  // Mark as sent either way — an empty morning shouldn't get re-checked
  // every 15 minutes for the rest of the hour, it just means no push.
  await db.from("app_settings").update({ last_digest_sent_date: today }).eq("household_id", householdId);
  if (titles.length === 0) return false;

  await sendPushToAll({
    title: `${titles.length} thing${titles.length === 1 ? "" : "s"} need${titles.length === 1 ? "s" : ""} you today`,
    body: titles.slice(0, 3).join(" · ") + (titles.length > 3 ? ` +${titles.length - 3} more` : ""),
    url: "/",
  });
  return true;
}
