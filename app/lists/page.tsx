import { getListsData, groupTasksByOwner, summarizeWeeklyTasks } from "@/lib/lists";
import { getTodoLists } from "@/lib/todo-lists";
import { getHandledItems } from "@/lib/handled";
import { getParents } from "@/lib/env";
import { formatTime, formatPlainDate } from "@/lib/format";
import { ListsTabs, type ListsTab } from "../components/ListsTabs";
import {
  toggleTodoItem,
  addTodoItem,
  deleteTodoItem,
  createTodoList,
  deleteTodoList,
  toggleTask,
  addTask,
  deleteTask,
  addReminder,
  deleteReminder,
  undoHandled,
} from "../actions";

export const dynamic = "force-dynamic";

const ICONS = {
  list: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  tasks: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  reminders: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  handled: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
};

function SectionHead({
  icon,
  title,
  count,
  deleteAction,
  deleteId,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  deleteAction?: (formData: FormData) => void;
  deleteId?: string;
}) {
  return (
    <div className="list-section-head">
      <span className="list-section-icon">{icon}</span>
      <span className="list-section-title">{title}</span>
      <span className="list-section-count">{count}</span>
      {deleteAction && deleteId && (
        <form action={deleteAction} className="list-section-delete">
          <input type="hidden" name="id" value={deleteId} />
          <button type="submit" className="btn btn-ghost">
            Delete list
          </button>
        </form>
      )}
    </div>
  );
}

export default async function ListsPage() {
  const [{ tasks, reminders }, todoLists, handledItems] = await Promise.all([
    getListsData(),
    getTodoLists(),
    getHandledItems(),
  ]);
  const parents = getParents();
  const tasksByOwner = groupTasksByOwner(tasks);
  const weekSummary = summarizeWeeklyTasks(tasks);

  const tabs: ListsTab[] = [
    ...todoLists.map(({ list, items }) => ({
      id: `list-${list.id}`,
      label: list.name,
      content: (
        <div className="list-section">
          <SectionHead
            icon={ICONS.list}
            title={list.name}
            count={items.length}
            deleteAction={deleteTodoList}
            deleteId={list.id}
          />

          {items.map((item) => (
            <div className={`gro-item${item.done ? " done" : ""}`} key={item.id}>
              <form action={toggleTodoItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="done" value={String(item.done)} />
                <button type="submit" className="gro-check" aria-label="Toggle done" />
              </form>
              <span>{item.name}</span>
              {item.added_by && <span className="gro-why">{item.added_by}</span>}
              <form action={deleteTodoItem}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="item-delete" aria-label="Delete item">
                  ×
                </button>
              </form>
            </div>
          ))}

          <form action={addTodoItem}>
            <input type="hidden" name="list_id" value={list.id} />
            <div className="gro-item gro-new">
              <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
              <input type="text" name="name" placeholder="Add item…" autoComplete="off" />
            </div>
          </form>
        </div>
      ),
    })),
    {
      id: "tasks",
      label: "Tasks",
      content: (
        <div className="list-section">
          <SectionHead icon={ICONS.tasks} title="Shared tasks — this week" count={weekSummary.totalTasks} />

          {weekSummary.byOwner.length > 0 && (
            <div className="balance">
              <h3>
                {weekSummary.totalDone} of {weekSummary.totalTasks} done this week
              </h3>
              <div className="bal-bar">
                {weekSummary.byOwner.map((o, i) => (
                  <div
                    key={o.owner}
                    style={{
                      width: `${weekSummary.totalTasks > 0 ? (o.total / weekSummary.totalTasks) * 100 : 0}%`,
                      background: i === 0 ? "var(--brand)" : "var(--brand-soft)",
                    }}
                  />
                ))}
              </div>
              <div className="bal-legend">
                {weekSummary.byOwner.map((o) => (
                  <span key={o.owner}>
                    <strong>{o.owner}</strong> · {o.done} of {o.total} done ({o.percentDone}%)
                  </span>
                ))}
              </div>
              {weekSummary.leader && (
                <p className="week-leader">
                  <strong>{weekSummary.leader}</strong> completed the most tasks this week
                </p>
              )}
            </div>
          )}

          {tasksByOwner.map(({ owner, tasks }) => (
            <div key={owner}>
              <p className="aisle">{owner}</p>
              {tasks.map((task) => (
                <div className={`task-row${task.done ? " done" : ""}`} key={task.id}>
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="done" value={String(task.done)} />
                    <button type="submit" className="gro-check" aria-label="Toggle done" />
                  </form>
                  <span className="t-name">{task.title}</span>
                  <div className="task-meta">
                    {task.priority && (
                      <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                    )}
                    {task.due_date && <span className="due-badge">{formatPlainDate(task.due_date)}</span>}
                  </div>
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="item-delete" aria-label="Delete task">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ))}

          <form action={addTask}>
            <div className="form-stack">
              <input type="text" name="title" placeholder="Add task…" autoComplete="off" />
              <div className="form-stack-row">
                {parents.length > 0 && (
                  <select name="owner_name" defaultValue={parents[0]}>
                    {parents.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
                <input type="date" name="due_date" />
                <select name="priority" defaultValue="">
                  <option value="">No priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <button type="submit" className="btn btn-outline">
                Add task
              </button>
            </div>
          </form>
        </div>
      ),
    },
    {
      id: "reminders",
      label: "Reminders",
      content: (
        <div className="list-section">
          <SectionHead icon={ICONS.reminders} title="Reminders" count={reminders.length} />

          {reminders.length === 0 && <p className="empty-day">No reminders set</p>}

          {reminders.map((reminder) => (
            <div className="rem-item" key={reminder.id}>
              <span className="rem-time">{formatTime(reminder.remind_at)}</span>
              <div style={{ flex: 1 }}>
                <p className="rem-title">{reminder.title}</p>
                {reminder.subtitle && <p className="rem-sub">{reminder.subtitle}</p>}
              </div>
              <form action={deleteReminder}>
                <input type="hidden" name="id" value={reminder.id} />
                <button type="submit" className="btn btn-ghost">
                  Dismiss
                </button>
              </form>
            </div>
          ))}

          <form action={addReminder}>
            <div className="form-stack">
              <input type="text" name="title" placeholder="Reminder…" autoComplete="off" />
              <div className="form-stack-row">
                <input type="datetime-local" name="remind_at" required />
                <input type="text" name="subtitle" placeholder="Details (optional)" autoComplete="off" />
              </div>
              <button type="submit" className="btn btn-outline">
                Add reminder
              </button>
            </div>
          </form>
        </div>
      ),
    },
    {
      id: "handled",
      label: "Handled",
      content: (
        <div className="list-section">
          <SectionHead icon={ICONS.handled} title="Handled" count={handledItems.length} />

          {handledItems.length === 0 && <p className="empty-day">Nothing dismissed yet</p>}

          {handledItems.map((item) => (
            <div className="rem-item" key={item.id}>
              <span
                className="rem-time"
                style={
                  item.dismissal_reason === "done"
                    ? { color: "var(--brand)", background: "var(--brand-tint)" }
                    : { color: "var(--ink-faint)", background: "var(--seg-bg)" }
                }
              >
                {item.dismissal_reason === "done" ? "Done" : "Ignored"}
              </span>
              <div style={{ flex: 1 }}>
                <p className="rem-title">{item.title}</p>
                <p className="rem-sub">{item.provenance_label}</p>
              </div>
              <form action={undoHandled}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="btn btn-ghost">
                  Undo
                </button>
              </form>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="greeting" style={{ fontSize: 20, marginBottom: 14 }}>
        Lists
      </h1>

      <form action={createTodoList} className="new-list-form">
        <input type="text" name="name" placeholder="New list name (e.g. Grocery, Packing)…" autoComplete="off" />
        <button type="submit" className="btn btn-outline">
          + New list
        </button>
      </form>

      <ListsTabs tabs={tabs} />
    </>
  );
}
