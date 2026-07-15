import { redirect } from "next/navigation";
import { getGeminiCustomInstructions, getJobStatus } from "@/lib/settings";
import { getCurrentHouseholdId, getHouseholdMembers } from "@/lib/household";
import { getKidsByHousehold } from "@/lib/kids";
import { formatRelativeTime } from "@/lib/format";
import { updateGeminiInstructions, addKidAction, deleteKidAction } from "../actions";
import { supabaseServer } from "@/lib/supabase-server";
import { EnableNotifications } from "../components/EnableNotifications";
import { TestNotificationButton } from "../components/TestNotificationButton";
import { InviteButton } from "../components/InviteButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/onboarding");

  const [instructions, status, members, kids] = await Promise.all([
    getGeminiCustomInstructions(householdId),
    getJobStatus(householdId),
    getHouseholdMembers(householdId),
    getKidsByHousehold(householdId),
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
        <p className="attn-body" style={{ marginTop: 14, fontSize: 12.5 }}>
          Want to connect another parent&apos;s Gmail for email scanning?{" "}
          <a href="/onboarding?step=3" style={{ color: "var(--brand)" }}>
            Go to the Gmail connect step
          </a>
          .
        </p>
      </div>

      <div className="list-section" style={{ maxWidth: 640, marginBottom: 20 }}>
        <div className="list-section-head">
          <span className="list-section-title">Kids</span>
        </div>
        {kids.length > 0 && (
          <ul className="onboard-kid-list" style={{ justifyContent: "flex-start", marginBottom: 14 }}>
            {kids.map((k) => (
              <li key={k.id} className={`kid kid-${k.color_key}`}>
                <span className="dot" />
                {k.name}
                <form action={deleteKidAction} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={k.id} />
                  <button type="submit" className="comment-delete" aria-label={`Remove ${k.name}`}>
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addKidAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" name="name" placeholder="Kid's name" className="comment-input" style={{ maxWidth: 200 }} required />
          <input type="text" name="context" placeholder="School/daycare (optional)" className="comment-input" style={{ maxWidth: 240 }} />
          <button className="btn btn-outline" type="submit">
            Add kid
          </button>
        </form>
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
