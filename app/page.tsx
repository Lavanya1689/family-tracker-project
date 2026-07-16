import { redirect } from "next/navigation";
import type { Item } from "@/lib/types";
import type { ItemComment } from "@/lib/comments";
import { getCurrentHouseholdId, getHouseholdMembers } from "@/lib/household";
import { getTodayData } from "@/lib/today";
import { formatTodayLabel } from "@/lib/format";
import { getCommentsByItemIds } from "@/lib/comments";
import { supabaseServer } from "@/lib/supabase-server";
import { AttentionCard } from "./components/AttentionCard";
import { AttentionGroupCard } from "./components/AttentionGroupCard";
import { CommentPanel } from "./components/CommentPanel";
import { TimelineItem } from "./components/TimelineItem";
import { EnableNotifications } from "./components/EnableNotifications";
import { RefreshButton } from "./components/RefreshButton";
import { AddEventModal } from "./components/AddEventModal";
import { addGroupToCalendar, markGroupDone, ignoreGroup } from "./actions";

export const dynamic = "force-dynamic";

// A skimmable preview of what's in a collapsed group, so deciding what to
// do with a 12-item email doesn't require expanding it first.
function groupPreview(items: Item[]): string {
  const shown = items.slice(0, 2).map((i) => i.title);
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(" · ")} +${rest} more` : shown.join(" · ");
}

// One merged conversation per email, not per item — comments only have a
// single item_id to attach to, so new ones from this panel land on the
// group's first item (an anchor, not a meaningful distinction to the
// user), but this reads every comment across all of the group's items in
// one place in case any existed from before line items had comments moved
// off them.
function mergeGroupComments(items: Item[], commentsByItem: Map<string, ItemComment[]>): ItemComment[] {
  return items
    .flatMap((item) => commentsByItem.get(item.id) ?? [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function EmptyBoard({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-card">
      <svg width="48" height="48" viewBox="0 0 56 56" fill="none">
        <rect x="5" y="5" width="46" height="35" rx="6" fill="var(--brand-tint)" stroke="var(--brand)" strokeWidth="1.6" />
        <circle cx="28" cy="12.5" r="3.2" fill="var(--urgent)" />
        <rect x="12" y="18" width="14" height="4" rx="2" fill="var(--kidA)" opacity="0.55" />
        <rect x="12" y="25" width="20" height="4" rx="2" fill="var(--kidB)" opacity="0.55" />
        <path d="M21 31l4 4 8-8" stroke="var(--scheduled)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 48l3.5-6M43 48l-3.5-6" stroke="var(--ink-faint)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <p>{children}</p>
    </div>
  );
}

export default async function TodayPage() {
  // Data queries here aren't household-scoped yet (Phase C) — there's
  // exactly one household today, so this doesn't leak anything, but it
  // does need to gate access so a signed-in, not-yet-onboarded account
  // can't render this page's real content before creating/joining one.
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/onboarding");

  const { kids, attentionEntries, todayEvents, emailsReadRecently } = await getTodayData();
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

  const attentionItemIds = attentionEntries.flatMap((e) =>
    e.kind === "single" ? [e.item.id] : e.group.items.map((i) => i.id)
  );
  const [commentsByItem, members, supabase] = await Promise.all([
    getCommentsByItemIds(attentionItemIds),
    getHouseholdMembers(householdId),
    supabaseServer(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserEmail = user?.email ?? "";
  const memberEmails = members.map((m) => m.user_email);

  const attentionCount = attentionEntries.reduce(
    (n, e) => n + (e.kind === "single" ? 1 : e.group.items.length),
    0
  );

  return (
    <>
      <div className="header-glow" />
      <div className="page-head">
        <div>
          <h1 className="greeting">Good morning</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RefreshButton />
          <EnableNotifications />
        </div>
      </div>
      <p className="subgreet">
        Nestly read <strong>{emailsReadRecently}</strong> emails recently.{" "}
        {attentionCount > 0 ? (
          <>
            <strong>{attentionCount}</strong> thing{attentionCount === 1 ? "" : "s"} need
            {attentionCount === 1 ? "s" : ""} you today.
          </>
        ) : (
          "Nothing needs you right now."
        )}
      </p>

      <div className="web-cols">
        <div>
          <p className="sec-label">Needs attention</p>
          {attentionEntries.length === 0 && (
            <EmptyBoard>You&apos;re all caught up.</EmptyBoard>
          )}
          {attentionEntries.map((entry, i) =>
            entry.kind === "single" ? (
              <AttentionCard
                key={entry.item.id}
                item={entry.item}
                kid={kidById(entry.item.kid_id)}
                isHero={i === 0}
                comments={commentsByItem.get(entry.item.id) ?? []}
                currentUserEmail={currentUserEmail}
                memberEmails={memberEmails}
              />
            ) : (
              <AttentionGroupCard
                key={entry.group.items[0].id}
                label={entry.group.label}
                count={entry.group.items.length}
                quickbar={
                  <div className="attn-group-quickbar">
                    <p className="attn-group-preview">{groupPreview(entry.group.items)}</p>
                    <div className="attn-group-quickactions">
                      <form action={addGroupToCalendar}>
                        <input type="hidden" name="gmail_message_id" value={entry.group.messageId} />
                        <button className="btn btn-primary" type="submit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="17" rx="2" />
                            <path d="M3 9h18M8 2v4M16 2v4M12 13v5M9.5 15.5h5" />
                          </svg>
                          Add to calendar
                        </button>
                      </form>
                      <a
                        className="btn btn-icon btn-info"
                        href={`https://mail.google.com/mail/u/0/#all/${entry.group.messageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View email"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="M3 7l9 6 9-6" />
                        </svg>
                      </a>
                      <form action={markGroupDone}>
                        <input type="hidden" name="gmail_message_id" value={entry.group.messageId} />
                        <button className="btn btn-icon btn-success" type="submit" title="Done">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </button>
                      </form>
                      <form action={ignoreGroup}>
                        <input type="hidden" name="gmail_message_id" value={entry.group.messageId} />
                        <button className="btn btn-icon btn-danger-outline" type="submit" title="Ignore">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </form>
                      <CommentPanel
                        itemId={entry.group.items[0].id}
                        itemTitle={entry.group.label}
                        comments={mergeGroupComments(entry.group.items, commentsByItem)}
                        currentUserEmail={currentUserEmail}
                        memberEmails={memberEmails}
                      />
                    </div>
                  </div>
                }
              >
                {entry.group.items.map((item) => (
                  <AttentionCard
                    key={item.id}
                    item={item}
                    kid={kidById(item.kid_id)}
                    inGroup
                  />
                ))}
              </AttentionGroupCard>
            )
          )}
        </div>

        <div>
          <p className="sec-label">{formatTodayLabel()}</p>
          {todayEvents.length === 0 && (
            <EmptyBoard>Nothing scheduled — enjoy it.</EmptyBoard>
          )}
          {todayEvents.map((item) => (
            <TimelineItem key={item.id} item={item} kid={kidById(item.kid_id)} />
          ))}
        </div>
      </div>
      <AddEventModal kids={kids} />
    </>
  );
}
