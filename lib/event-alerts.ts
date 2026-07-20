import { supabaseAdmin } from "./supabase";
import { sendPushToAll } from "./push";
import { formatTimeInTz } from "./timezone";

interface AlertRule {
  column: "day_before_alert_sent_at" | "hour_before_alert_sent_at";
  leadMinutes: number;
  // How far past the lead time a run is still allowed to catch up — the
  // reminders cron is only roughly-hourly (GitHub's `schedule` trigger can
  // lag, see the digest bug from 2026-07-16), so a run isn't guaranteed to
  // land exactly at the lead time. 0 means "must still be in the future."
  staleAfterMinutes: number;
  label: string;
}

// Day-before must still be in the future (staleAfterMinutes: 0) — once an
// event's start has passed, "tomorrow" no longer makes sense; hour-before
// tolerates catching up a few hours late so a cron gap doesn't just skip it.
const RULES: AlertRule[] = [
  { column: "day_before_alert_sent_at", leadMinutes: 24 * 60, staleAfterMinutes: 0, label: "Tomorrow" },
  { column: "hour_before_alert_sent_at", leadMinutes: 60, staleAfterMinutes: 4 * 60, label: "Starting soon" },
];

export interface EventAlertResult {
  alertsSent: number;
}

// Pushes one notification per timed, scheduled event for each lead-time
// rule whose window it's newly inside. All-day events are skipped — no
// specific time to count down to, and they already surface on Today/the
// calendar feed. Piggybacks on the same ~hourly reminders cron as
// sendDailyDigestIfDue, no separate infrastructure.
export async function sendUpcomingEventAlerts(householdId: string): Promise<EventAlertResult> {
  const db = supabaseAdmin();
  const now = new Date();
  let alertsSent = 0;

  for (const rule of RULES) {
    const windowEnd = new Date(now.getTime() + rule.leadMinutes * 60_000).toISOString();
    const windowStart = new Date(now.getTime() - rule.staleAfterMinutes * 60_000).toISOString();

    const { data: items, error } = await db
      .from("items")
      .select("id, title, starts_at, provenance_label")
      .eq("household_id", householdId)
      .eq("status", "scheduled")
      .eq("all_day", false)
      .is(rule.column, null)
      .not("starts_at", "is", null)
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd);
    if (error) throw error;

    for (const item of items ?? []) {
      try {
        await sendPushToAll({
          title: `${rule.label}: ${item.title}`,
          body: `${formatTimeInTz(item.starts_at as string)} · ${item.provenance_label}`,
          url: "/",
        });
        const { error: updateError } = await db
          .from("items")
          .update({ [rule.column]: new Date().toISOString() })
          .eq("id", item.id);
        if (updateError) throw updateError;
        alertsSent++;
      } catch (err) {
        // One item's failed push/update must not block the rest of the
        // batch — it stays un-alerted and is retried next run (as long as
        // it's still inside the window).
        console.error(`Failed to send "${rule.label}" alert for "${item.title}":`, err);
      }
    }
  }

  return { alertsSent };
}
