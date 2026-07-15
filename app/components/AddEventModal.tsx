"use client";

import { useState, useEffect } from "react";
import type { Kid } from "@/lib/types";
import { addManualItem } from "../actions";

export function AddEventModal({ kids }: { kids: Kid[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"event" | "deadline" | "action_item">("event");
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="add-event-fab" onClick={() => setOpen(true)} aria-label="Add event">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div className="comment-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comment-modal-head">
              <p className="comment-modal-title">Add something</p>
              <button type="button" className="comment-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                await addManualItem(formData);
                setOpen(false);
              }}
              className="add-event-form"
            >
              <input type="text" name="title" placeholder="What is it?" className="comment-input" required autoFocus />

              <div className="add-event-kind">
                {(["event", "deadline", "action_item"] as const).map((k) => (
                  <label key={k} className={`add-event-kind-option${kind === k ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                      style={{ display: "none" }}
                    />
                    {k === "event" ? "Event" : k === "deadline" ? "Deadline" : "To-do"}
                  </label>
                ))}
              </div>

              <div className="add-event-row">
                <input type="date" name="date" className="comment-input" required />
                {!allDay && <input type="time" name="time" className="comment-input" />}
              </div>

              {kind === "event" && (
                <label className="add-event-checkbox">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                  />
                  All day
                  <input type="hidden" name="all_day" value={allDay ? "true" : "false"} />
                </label>
              )}

              {kids.length > 0 && (
                <select name="kid_id" className="comment-input" defaultValue="">
                  <option value="">Who&apos;s it for? (optional)</option>
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              )}

              <textarea name="notes" placeholder="Notes (optional)" className="settings-textarea" rows={3} />

              <button className="btn btn-primary" type="submit">
                Add
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
