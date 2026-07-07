export function formatDueLabel(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return "Needs attention";

  const due = new Date(dueAt);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000
  );

  if (diffDays < 0) return "Past due";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function formatTime(dateTime: string): string {
  const d = new Date(dateTime);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return time.replace(" AM", "a").replace(" PM", "p").replace(":00", "");
}

export function formatTodayLabel(now: Date = new Date()): string {
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Today · ${weekday}, ${date}`;
}
