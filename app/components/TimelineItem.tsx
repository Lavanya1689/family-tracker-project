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
        </div>
      </div>
    </div>
  );
}
