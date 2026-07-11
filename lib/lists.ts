import { supabaseAdmin } from "./supabase";
import { startOfWeekUtc } from "./timezone";
import type { Task, Reminder } from "./types";

export interface ListsData {
  tasks: Task[];
  reminders: Reminder[];
}

export async function getListsData(): Promise<ListsData> {
  const db = supabaseAdmin();
  const weekStart = startOfWeekUtc();

  const [{ data: tasks }, { data: reminders }] = await Promise.all([
    // Tasks are scoped to the current calendar week (Mon-Sun) — "shared
    // tasks" is a weekly tally, not an all-time list.
    db
      .from("tasks")
      .select("*")
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: true }),
    db.from("reminders").select("*").order("remind_at", { ascending: true }),
  ]);

  return {
    tasks: (tasks ?? []) as Task[],
    reminders: (reminders ?? []) as Reminder[],
  };
}

// Groups this week's tasks by owner — "who owned what" at a glance,
// instead of one flat list with a small chip per row.
export function groupTasksByOwner(tasks: Task[]): { owner: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!groups.has(task.owner_name)) groups.set(task.owner_name, []);
    groups.get(task.owner_name)!.push(task);
  }
  return Array.from(groups.entries()).map(([owner, tasks]) => ({ owner, tasks }));
}

export interface OwnerTally {
  owner: string;
  total: number;
  done: number;
  percentDone: number;
}

export interface WeeklyTaskSummary {
  totalTasks: number;
  totalDone: number;
  byOwner: OwnerTally[];
  leader: string | null; // owner with strictly more completed tasks; null if tied/empty
}

// This week's completion tally per owner — "who did better" is a factual
// count comparison, not an AI judgment call.
export function summarizeWeeklyTasks(tasks: Task[]): WeeklyTaskSummary {
  const byOwnerMap = new Map<string, OwnerTally>();
  for (const task of tasks) {
    const existing = byOwnerMap.get(task.owner_name) ?? {
      owner: task.owner_name,
      total: 0,
      done: 0,
      percentDone: 0,
    };
    existing.total += 1;
    if (task.done) existing.done += 1;
    byOwnerMap.set(task.owner_name, existing);
  }

  const byOwner = Array.from(byOwnerMap.values()).map((tally) => ({
    ...tally,
    percentDone: tally.total > 0 ? Math.round((tally.done / tally.total) * 100) : 0,
  }));

  let leader: string | null = null;
  if (byOwner.length > 0) {
    const sorted = [...byOwner].sort((a, b) => b.done - a.done);
    if (sorted.length === 1 || sorted[0].done > sorted[1].done) {
      leader = sorted[0].done > 0 ? sorted[0].owner : null;
    }
  }

  return {
    totalTasks: tasks.length,
    totalDone: tasks.filter((t) => t.done).length,
    byOwner,
    leader,
  };
}
