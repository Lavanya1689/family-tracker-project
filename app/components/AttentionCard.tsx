import type { Item, Kid } from "@/lib/types";
import { formatDueLabel } from "@/lib/format";
import { KidChip } from "./KidChip";
import { markHandled } from "../actions";

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
        <span className="due">{formatDueLabel(item.due_at)}</span>
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
      <form action={markHandled} className="attn-actions">
        <input type="hidden" name="id" value={item.id} />
        <button className="btn btn-primary" type="submit">
          Mark handled
        </button>
      </form>
    </div>
  );
}
