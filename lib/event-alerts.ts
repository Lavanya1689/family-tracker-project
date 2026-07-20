import { supabaseAdmin } from "./supabase";
import { sendPushToAll } from "./push";
import { formatTimeInTz } from "./timezone";

// How far ahead of a timed event's start to alert — "starts in under an
// hour" is close enough to be actionable (leave now) without being so early
// it reads as noise.
const LEAD_MINUTES = 60;
// Safety bound on the other side: don't alert for an event whose start has
// already passed by more than this — protects against a long cron gap (see
// the digest bug, GitHub's `schedule` trigger can lag hours) surfacing a
// pile of stale "starting soon" pushes for events that are already over.
const STALE_AFTER_MINUTES = 4 * 60;

export interface EventAlertResult {
  alertsSent: number;
}

// Pushes one notification per timed, scheduled event whose start falls
// inside the lead-time window and hasn't been alerted yet. All-day events
// are skipped — they have no specific time to count down to, and already
// surface on Today/the digest. Piggybacks on the same ~hourly reminders
// cron as sendDailyDigestIfDue, no separate infrastructure.
export async function sendUpcomingEventAlerts(householdId: string): Promise<EventAlertResult> {
  const db = supabaseAdmin();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + LEAD_MINUTES * 60_000).toISOString();
  const windowStart = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000).toISOString();

  const { data: items, error } = await db
    .from("items")
    .select("id, title, starts_at, provenance_label")
    .eq("household_id", householdId)
    .eq("status", "scheduled")
    .eq("all_day", false)
    .is("start_alert_sent_at", null)
    .not("starts_at", "is", null)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);
  if (error) throw error;

  let alertsSent = 0;
  for (const item of items ?? []) {
    try {
      await sendPushToAll({
        title: `Starting soon: ${item.title}`,
        body: `${formatTimeInTz(item.starts_at as string)} · ${item.provenance_label}`,
        url: "/",
      });
      const { error: updateError } = await db
        .from("items")
        .update({ start_alert_sent_at: new Date().toISOString() })
        .eq("id", item.id);
      if (updateError) throw updateError;
      alertsSent++;
    } catch (err) {
      // One item's failed push/update must not block the rest of the
      // batch — it stays un-alerted and is retried next run (as long as
      // it's still inside the window).
      console.error(`Failed to send upcoming-event alert for "${item.title}":`, err);
    }
  }

  return { alertsSent };
}
