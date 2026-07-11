import type { Item, Kid } from "@/lib/types";
import { formatDueLabel } from "@/lib/format";
import { KidChip } from "./KidChip";
import { addToCalendar, ignoreItem, markDone } from "../actions";

export function AttentionCard({
  item,
  kid,
}: {
  item: Item;
  kid: Pick<Kid, "name" | "color_key"> | null;
}) {
  return (
    <div className="attn">
      <div className="attn-head">
        <span className="attn-title">{item.title}</span>
        <span className="due">{formatDueLabel(item.due_at, item.kind)}</span>
      </div>
      {item.description && <p className="attn-body">{item.description}</p>}
      <div className="tl-meta">
        <KidChip kid={kid} />
      </div>
      <div className="prov">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v16H4z" />
          <path d="M4 7l8 6 8-6" />
        </svg>
        {item.provenance_label}
      </div>
      <div className="attn-actions">
        <form action={addToCalendar}>
          <input type="hidden" name="id" value={item.id} />
          <button className="btn btn-primary" type="submit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4M12 13v5M9.5 15.5h5" />
            </svg>
            Add to calendar
          </button>
        </form>
        {item.source_type === "gmail" && item.gmail_message_id && (
          <a
            className="btn btn-ghost"
            href={`https://mail.google.com/mail/u/0/#all/${item.gmail_message_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View email
          </a>
        )}
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
  );
}
