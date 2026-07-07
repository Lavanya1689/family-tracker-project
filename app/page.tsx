import { getTodayData } from "@/lib/today";
import { formatTodayLabel } from "@/lib/format";
import { AttentionCard } from "./components/AttentionCard";
import { TimelineItem } from "./components/TimelineItem";
import { EnableNotifications } from "./components/EnableNotifications";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { kids, needsAttention, todayEvents, emailsReadRecently } = await getTodayData();
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

  return (
    <main className="main">
      <div className="topbar">
        <div className="brand">
          <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
            <path d="M4 15c0 5 4 8 9 8s9-3 9-8" stroke="#0E4F45" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M7 15c0-1 .5-4 6-4s6 3 6 4" stroke="#0E4F45" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="13" cy="7" r="2.6" fill="#B45309" />
          </svg>
          Nestly
        </div>
        <EnableNotifications />
      </div>

      <h1 className="greeting">Good morning</h1>
      <p className="subgreet">
        Nestly read <strong>{emailsReadRecently}</strong> emails recently.{" "}
        {needsAttention.length > 0 ? (
          <>
            <strong>{needsAttention.length}</strong> thing{needsAttention.length === 1 ? "" : "s"} need
            {needsAttention.length === 1 ? "s" : ""} you today.
          </>
        ) : (
          "Nothing needs you right now."
        )}
      </p>

      <div className="web-cols">
        <div>
          <p className="sec-label">Needs attention</p>
          {needsAttention.length === 0 && (
            <p className="empty-day">You&apos;re all caught up.</p>
          )}
          {needsAttention.map((item) => (
            <AttentionCard key={item.id} item={item} kid={kidById(item.kid_id)} />
          ))}
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
    </main>
  );
}
