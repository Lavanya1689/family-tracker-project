import { redirect } from "next/navigation";
import { getGeminiCustomInstructions, getJobStatus } from "@/lib/settings";
import { getCurrentHouseholdId, getHouseholdMembers } from "@/lib/household";
import { formatRelativeTime } from "@/lib/format";
import { updateGeminiInstructions } from "../actions";
import { supabaseServer } from "@/lib/supabase-server";
import { EnableNotifications } from "../components/EnableNotifications";
import { TestNotificationButton } from "../components/TestNotificationButton";
import { InviteButton } from "../components/InviteButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/onboarding");

  const [instructions, status, members] = await Promise.all([
    getGeminiCustomInstructions(householdId),
    getJobStatus(householdId),
    getHouseholdMembers(householdId),
  ]);
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <h1 className="greeting" style={{ fontSize: 20, marginBottom: 14 }}>
        Settings
      </h1>

      <div className="list-section" style={{ maxWidth: 640, marginBottom: 20 }}>
        <div className="list-section-head">
          <span className="list-section-title">Account</span>
        </div>
        <p className="attn-body" style={{ marginBottom: 14 }}>
          Signed in as <strong>{user?.email}</strong>
        </p>
        <form action="/auth/signout" method="POST">
          <button className="btn btn-ghost btn-outline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <div className="list-section" style={{ maxWidth: 640, marginBottom: 20 }}>
        <div className="list-section-head">
          <span className="list-section-title">Household</span>
        </div>
        <div style={{ marginBottom: 14 }}>
          {members.map((m) => (
            <p className="attn-body" key={m.user_email} style={{ marginBottom: 4 }}>
              {m.user_email} — joined {formatRelativeTime(m.joined_at)}
            </p>
          ))}
        </div>
        <InviteButton />
      </div>

      <div className="list-section" style={{ maxWidth: 640, marginBottom: 20 }}>
        <div className="list-section-head">
          <span className="list-section-title">Notifications & sync status</span>
        </div>
        <p className="attn-body" style={{ marginBottom: 4 }}>
          Push subscriptions on this account:{" "}
          <strong>{status.pushSubscriptionCount}</strong>
          {status.pushSubscriptionCount === 0 && " — tap \"Enable notifications\" below on this device"}
        </p>
        <p className="attn-body" style={{ marginBottom: 4 }}>
          Gmail sync last ran: <strong>{formatRelativeTime(status.lastGmailSyncAt)}</strong>
        </p>
        <p className="attn-body" style={{ marginBottom: 4 }}>
          ICS sync last ran: <strong>{formatRelativeTime(status.lastIcsSyncAt)}</strong>
        </p>
        <p className="attn-body" style={{ marginBottom: 14 }}>
          Reminders cron last ran: <strong>{formatRelativeTime(status.lastRemindersRunAt)}</strong>
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <EnableNotifications />
          <TestNotificationButton />
        </div>
      </div>

      <div className="list-section" style={{ maxWidth: 640 }}>
        <div className="list-section-head">
          <span className="list-section-title">Gemini extraction instructions</span>
        </div>
        <p className="attn-body" style={{ marginBottom: 14 }}>
          This is added on top of Nestly&apos;s built-in extraction rules — use it to
          steer what counts as worth surfacing for your family specifically. It applies
          to every email scanned, across all connected inboxes.
        </p>
        <form action={updateGeminiInstructions}>
          <textarea
            name="instructions"
            defaultValue={instructions ?? ""}
            placeholder={
              'e.g. "Always flag anything mentioning Aanya\'s allergy." or "Ignore newsletters from the PTA unless they mention a deadline."'
            }
            rows={8}
            className="settings-textarea"
          />
          <div className="attn-actions">
            <button className="btn btn-primary" type="submit">
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
