import type { WeekData } from "@/lib/week";
import { formatDateInTz } from "@/lib/timezone";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A color-dot day-density row above the Today columns — one dot per kid who
// has something that day, plus an urgent dot if anything's still
// needs_attention, so the week has visual rhythm instead of a bare label.
export function WeekStrip({ week }: { week: WeekData }) {
  return (
    <div className="week-strip">
      {week.days.map((day, i) => {
        const kidIds = Array.from(new Set(day.items.map((item) => item.kid_id).filter(Boolean)));
        const hasUrgent = day.items.some((item) => item.status === "needs_attention");

        return (
          <div key={day.date.toISOString()} className={`week-day${day.isToday ? " today" : ""}`}>
            <div className="dow">{DOW[i]}</div>
            <div className="num">{Number(formatDateInTz(day.date, undefined, { day: "numeric" }))}</div>
            <div className="dots">
              {hasUrgent && <span style={{ background: "var(--urgent)" }} />}
              {kidIds.map((kidId) => {
                const kid = week.kids.find((k) => k.id === kidId);
                if (!kid) return null;
                return (
                  <span
                    key={kidId}
                    style={{ background: kid.color_key === "a" ? "var(--kidA)" : "var(--kidB)" }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
