import type { Item, Kid } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { KidChip } from "./KidChip";

export function TimelineItem({
  item,
  kid,
}: {
  item: Item;
  kid: Pick<Kid, "name" | "color_key"> | null;
}) {
  return (
    <div className="tl-item">
      <span className="tl-time">{item.starts_at ? formatTime(item.starts_at) : "All day"}</span>
      <div>
        <p className="tl-title">{item.title}</p>
        {item.description && <p className="tl-sub">{item.description}</p>}
        <div className="tl-meta">
          <KidChip kid={kid} />
          {item.source_type === "ics" && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <title>From ICS calendar</title>
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
