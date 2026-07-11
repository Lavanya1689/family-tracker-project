import { getTodayData } from "@/lib/today";
import { formatTodayLabel } from "@/lib/format";
import { AttentionCard } from "./components/AttentionCard";
import { TimelineItem } from "./components/TimelineItem";
import { EnableNotifications } from "./components/EnableNotifications";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { kids, attentionEntries, todayEvents, emailsReadRecently } = await getTodayData();
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

  const attentionCount = attentionEntries.reduce(
    (n, e) => n + (e.kind === "single" ? 1 : e.group.items.length),
    0
  );

  return (
    <>
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
            <p className="empty-day">You&apos;re all caught up.</p>
          )}
          {attentionEntries.map((entry) =>
            entry.kind === "single" ? (
              <AttentionCard key={entry.item.id} item={entry.item} kid={kidById(entry.item.kid_id)} />
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
            <p className="empty-day">Nothing scheduled — enjoy it</p>
          )}
          {todayEvents.map((item) => (
            <TimelineItem key={item.id} item={item} kid={kidById(item.kid_id)} />
          ))}
        </div>
      </div>
    </>
  );
}
