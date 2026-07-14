import type { Item } from "@/lib/types";
import { getTodayData } from "@/lib/today";
import { formatTodayLabel } from "@/lib/format";
import { getCommentsByItemIds } from "@/lib/comments";
import { supabaseServer } from "@/lib/supabase-server";
import { AttentionCard } from "./components/AttentionCard";
import { TimelineItem } from "./components/TimelineItem";
import { EnableNotifications } from "./components/EnableNotifications";
import { addGroupToCalendar, markGroupDone, ignoreGroup } from "./actions";

export const dynamic = "force-dynamic";

// A skimmable preview of what's in a collapsed group, so deciding what to
// do with a 12-item email doesn't require expanding it first.
function groupPreview(items: Item[]): string {
  const shown = items.slice(0, 2).map((i) => i.title);
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(" · ")} +${rest} more` : shown.join(" · ");
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
  const { kids, attentionEntries, todayEvents, emailsReadRecently } = await getTodayData();
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

  const attentionItemIds = attentionEntries.flatMap((e) =>
    e.kind === "single" ? [e.item.id] : e.group.items.map((i) => i.id)
  );
  const [commentsByItem, supabase] = await Promise.all([
    getCommentsByItemIds(attentionItemIds),
    supabaseServer(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserEmail = user?.email ?? "";

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
        <EnableNotifications />
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
              />
            ) : (
              <details className="attn-group" key={entry.group.items[0].id}>
                <summary className="attn-group-summary">
                  From: {entry.group.label}
                  <span className="attn-group-count">{entry.group.items.length} items</span>
                </summary>
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
                      className="btn btn-info"
                      href={`https://mail.google.com/mail/u/0/#all/${entry.group.messageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View email
                    </a>
                    <form action={markGroupDone}>
                      <input type="hidden" name="gmail_message_id" value={entry.group.messageId} />
                      <button className="btn btn-success" type="submit">
                        Done
                      </button>
                    </form>
                    <form action={ignoreGroup}>
                      <input type="hidden" name="gmail_message_id" value={entry.group.messageId} />
                      <button className="btn btn-danger-outline" type="submit">
                        Ignore
                      </button>
                    </form>
                  </div>
                </div>
                <div className="attn-group-items">
                  {entry.group.items.map((item) => (
                    <AttentionCard
                      key={item.id}
                      item={item}
                      kid={kidById(item.kid_id)}
                      inGroup
                      comments={commentsByItem.get(item.id) ?? []}
                      currentUserEmail={currentUserEmail}
                    />
                  ))}
                </div>
              </details>
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
    </>
  );
}
