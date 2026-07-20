import { supabaseAdmin } from "./supabase";

// Gemini's free tier caps gemini-2.5-flash at 20 requests/day total — hit
// for real on 2026-07-20 once every email started reaching the model
// instead of ~5% of them (removing the sender-list gate) plus normal
// assistant use. One shared counter, checked by every Gemini caller
// (Gmail extraction, the assistant), not a per-feature quota — a quiet
// day for one leaves more room for the other.
const DAILY_CAP = 20;

// Google resets free-tier daily quotas at midnight Pacific, not the
// family's own configured timezone (APP_TIMEZONE) — using the family's
// timezone here would drift out of sync with when the real quota
// actually clears.
const QUOTA_RESET_TZ = "America/Los_Angeles";

function todayInQuotaTz(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: QUOTA_RESET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Attempts to reserve one Gemini call against today's shared budget.
// `ceiling` lets a caller voluntarily stop short of the full daily cap —
// Gmail extraction reserves under a lower ceiling (14) so the tail of the
// budget stays available for the assistant (ceiling 20), which is
// user-initiated and interactive: a parent asking a question right now
// should not lose out to a background sync that can just catch up later.
// Not fully atomic (read-then-write, no DB-level locking) — acceptable
// here given how low real concurrency is for a single household's cron +
// occasional assistant use, same application-level pragmatism the rest of
// this app already relies on instead of RLS/transactions.
export async function tryReserveGeminiCall(householdId: string, ceiling: number): Promise<boolean> {
  const db = supabaseAdmin();
  const today = todayInQuotaTz();

  const { data: settings, error } = await db
    .from("app_settings")
    .select("gemini_calls_today, gemini_calls_date")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw error;

  const isNewDay = settings?.gemini_calls_date !== today;
  const currentCount = isNewDay ? 0 : settings?.gemini_calls_today ?? 0;

  if (currentCount >= Math.min(ceiling, DAILY_CAP)) return false;

  const { error: updateError } = await db
    .from("app_settings")
    .update({ gemini_calls_today: currentCount + 1, gemini_calls_date: today })
    .eq("household_id", householdId);
  if (updateError) throw updateError;

  return true;
}
