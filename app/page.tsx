import { getTodayData } from "@/lib/today";
import { getWeekData } from "@/lib/week";
import { formatTodayLabel } from "@/lib/format";
import { AttentionCard } from "./components/AttentionCard";
import { TimelineItem } from "./components/TimelineItem";
import { EnableNotifications } from "./components/EnableNotifications";
import { WeekStrip } from "./components/WeekStrip";

export const dynamic = "force-dynamic";

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
  const [{ kids, attentionEntries, todayEvents, emailsReadRecently }, week] = await Promise.all([
    getTodayData(),
    getWeekData(),
  ]);
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

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

      <WeekStrip week={week} />

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
              />
            ) : (
              <details className="attn-group" key={entry.group.items[0].id}>
                <summary className="attn-group-summary">
                  From: {entry.group.label}
                  <span className="attn-group-count">{entry.group.items.length} items</span>
                </summary>
                <div className="attn-group-items">
                  {entry.group.items.map((item) => (
                    <AttentionCard key={item.id} item={item} kid={kidById(item.kid_id)} />
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
