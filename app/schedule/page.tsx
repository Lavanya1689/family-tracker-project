import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/household";
import { getDayData } from "@/lib/day";
import { getWeekData } from "@/lib/week";
import { getMonthData } from "@/lib/month";
import { getUnscheduledItems } from "@/lib/unscheduled";
import { localToUtcIso, addDaysUtc, addMonthsUtc, formatDateInTz, toIsoDateInTz } from "@/lib/timezone";
import { formatTime } from "@/lib/format";
import { ignoreItem, markDone, scheduleOnDate } from "../actions";
import type { Item, Kid } from "@/lib/types";

export const dynamic = "force-dynamic";

type ViewMode = "day" | "week" | "month";

function parseDateParam(dateParam: string | undefined): Date {
  const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toIsoDateInTz(new Date());
  return new Date(localToUtcIso(`${dateStr}T12:00:00`));
}

function toDateParam(date: Date): string {
  return toIsoDateInTz(date);
}

const KID_COLOR_VARS: Record<string, string> = {
  a: "var(--kidA)",
  b: "var(--kidB)",
  c: "var(--kidC)",
  d: "var(--kidD)",
};

function eventBarColor(item: Item, kidColorKey: Kid["color_key"] | null): string {
  if (item.kind !== "event") return "var(--urgent)";
  if (kidColorKey && KID_COLOR_VARS[kidColorKey]) return KID_COLOR_VARS[kidColorKey];
  return "var(--ink-faint)";
}

function eventTimeLabel(item: Item): string {
  if (item.all_day) return "all day";
  const anchor = item.starts_at ?? item.due_at;
  return anchor ? formatTime(anchor) : "";
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/onboarding");

  const params = await searchParams;
  const view: ViewMode = params.view === "day" || params.view === "month" ? params.view : "week";
  const refDate = parseDateParam(params.date);

  return (
    <>
      <div className="week-nav">
        <h2>Schedule</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ScheduleNav view={view} refDate={refDate} />
        </div>
      </div>

      <div className="view-switch">
        <Link
          href={`/schedule?view=day&date=${toDateParam(refDate)}`}
          className={view === "day" ? "active" : ""}
        >
          Day
        </Link>
        <Link
          href={`/schedule?view=week&date=${toDateParam(refDate)}`}
          className={view === "week" ? "active" : ""}
        >
          Week
        </Link>
        <Link
          href={`/schedule?view=month&date=${toDateParam(refDate)}`}
          className={view === "month" ? "active" : ""}
        >
          Month
        </Link>
      </div>

      {view === "day" && <DayView refDate={refDate} />}
      {view === "week" && <WeekView refDate={refDate} />}
      {view === "month" && <MonthView refDate={refDate} />}

      <UnscheduledSection />
    </>
  );
}

// Items added to the calendar with no date at all — without this, "Add to
// calendar" on a dateless item made it disappear everywhere with no way to
// see it again. Shown below the active view, not tied to any specific day.
async function UnscheduledSection() {
  const items = await getUnscheduledItems();
  if (items.length === 0) return null;

  return (
    <div className="day-block">
      <div className="day-head">
        <span className="day-name">Unscheduled</span>
        <span className="day-date">no date on this one</span>
      </div>
      {items.map((item) => (
        <div className="evt" key={item.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <span className="evt-bar" style={{ background: "var(--ink-faint)" }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div>{item.title}</div>
            <div className="prov" style={{ marginTop: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16v16H4z" />
                <path d="M4 7l8 6 8-6" />
              </svg>
              {item.provenance_label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <form action={scheduleOnDate} style={{ display: "flex", gap: 6 }}>
              <input type="hidden" name="id" value={item.id} />
              <input type="date" name="date" required className="unscheduled-date-input" />
              <button className="btn btn-outline" type="submit">
                Schedule
              </button>
            </form>
            <form action={markDone}>
              <input type="hidden" name="id" value={item.id} />
              <button className="btn btn-ghost" type="submit">
                Done
              </button>
            </form>
            <form action={ignoreItem}>
              <input type="hidden" name="id" value={item.id} />
              <button className="btn btn-ghost" type="submit">
                Ignore
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleNav({ view, refDate }: { view: ViewMode; refDate: Date }) {
  let prevDate: Date;
  let nextDate: Date;
  if (view === "day") {
    prevDate = addDaysUtc(refDate, -1);
    nextDate = addDaysUtc(refDate, 1);
  } else if (view === "month") {
    prevDate = addMonthsUtc(refDate, -1);
    nextDate = addMonthsUtc(refDate, 1);
  } else {
    prevDate = addDaysUtc(refDate, -7);
    nextDate = addDaysUtc(refDate, 7);
  }

  return (
    <>
      <Link href={`/schedule?view=${view}&date=${toDateParam(new Date())}`} className="btn btn-outline">
        Today
      </Link>
      <Link href={`/schedule?view=${view}&date=${toDateParam(prevDate)}`} className="btn btn-outline">
        ‹
      </Link>
      <Link href={`/schedule?view=${view}&date=${toDateParam(nextDate)}`} className="btn btn-outline">
        ›
      </Link>
    </>
  );
}

async function DayView({ refDate }: { refDate: Date }) {
  const { date, items, kids } = await getDayData(refDate);
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

  return (
    <div className="day-block">
      <div className="day-head">
        <span className="day-name">{formatDateInTz(date, undefined, { weekday: "long" })}</span>
        <span className="day-date">{formatDateInTz(date, undefined, { month: "long", day: "numeric" })}</span>
      </div>

      {items.length === 0 && <p className="empty-day">Nothing scheduled — enjoy it</p>}

      {items.map((item) => {
        const kid = kidById(item.kid_id);
        const flagged = item.kind !== "event";
        return (
          <div className={`evt${flagged ? " evt-flag" : ""}`} key={item.id}>
            <span className="evt-bar" style={{ background: eventBarColor(item, kid?.color_key ?? null) }} />
            {item.title}
            <span className="evt-time">{eventTimeLabel(item)}</span>
          </div>
        );
      })}
    </div>
  );
}

async function WeekView({ refDate }: { refDate: Date }) {
  const { days, kids } = await getWeekData(refDate);
  const kidById = (id: string | null) => kids.find((k) => k.id === id) ?? null;

  return (
    <>
      {days.map((day) => (
        <div className="day-block" key={day.date.toISOString()}>
          <div className="day-head">
            <span className="day-name">{formatDateInTz(day.date, undefined, { weekday: "long" })}</span>
            <span className="day-date">{formatDateInTz(day.date)}</span>
            {day.isToday && <span className="today-pill">Today</span>}
          </div>

          {day.items.length === 0 && <p className="empty-day">Nothing scheduled — enjoy it</p>}

          {day.items.map((item) => {
            const kid = kidById(item.kid_id);
            const flagged = item.kind !== "event";
            return (
              <div className={`evt${flagged ? " evt-flag" : ""}`} key={item.id}>
                <span
                  className="evt-bar"
                  style={{ background: eventBarColor(item, kid?.color_key ?? null) }}
                />
                {item.title}
                <span className="evt-time">{eventTimeLabel(item)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

async function MonthView({ refDate }: { refDate: Date }) {
  const { monthStart, weeks } = await getMonthData(refDate);

  return (
    <div className="month-view">
      <p className="month-title">{formatDateInTz(monthStart, undefined, { month: "long", year: "numeric" })}</p>
      <div className="month-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div className="month-weekday" key={d}>
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const visible = day.items.slice(0, 2);
          const overflow = day.items.length - visible.length;
          return (
            <Link
              href={`/schedule?view=day&date=${toDateParam(day.date)}`}
              key={day.date.toISOString()}
              className={`month-cell${day.inCurrentMonth ? "" : " other-month"}${day.isToday ? " today" : ""}`}
            >
              <span className="month-day-number">{formatDateInTz(day.date, undefined, { day: "numeric" })}</span>
              {visible.map((item) => (
                <span className="month-event" key={item.id}>
                  {item.title}
                </span>
              ))}
              {overflow > 0 && <span className="month-event-more">+{overflow} more</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
