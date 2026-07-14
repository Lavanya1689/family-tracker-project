import type { Item, Kid } from "@/lib/types";
import { formatDueLabel, formatRelativeTime } from "@/lib/format";
import { KidChip } from "./KidChip";
import { CategoryIcon } from "@/lib/category-icon";
import { authorDisplayName, type ItemComment } from "@/lib/comments";
import { CommentForm } from "./CommentForm";
import { addToCalendar, ignoreItem, markDone } from "../actions";

function SourceIcon({ sourceType }: { sourceType: Item["source_type"] }) {
  if (sourceType === "ics") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    );
  }
  if (sourceType === "manual") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export function AttentionCard({
  item,
  kid,
  isHero = false,
  inGroup = false,
  comments = [],
  currentUserEmail = "",
}: {
  item: Item;
  kid: Pick<Kid, "name" | "color_key"> | null;
  isHero?: boolean;
  // Rendered inside an expanded email group, where the source is already
  // shown once at the group level — repeating the identical provenance
  // line on every one of N items from the same email is pure noise.
  inGroup?: boolean;
  comments?: ItemComment[];
  currentUserEmail?: string;
}) {
  return (
    <div className={`attn${isHero ? " hero" : ""}`}>
      <div className="attn-head">
        <div className="attn-title-row">
          <CategoryIcon category={item.category} />
          <span className="attn-title">{item.title}</span>
        </div>
        <span className="due">{formatDueLabel(item.due_at, item.kind)}</span>
      </div>
      {item.description && <p className="attn-body">{item.description}</p>}
      <div className="tl-meta">
        <KidChip kid={kid} />
      </div>
      {!inGroup && (
        <div className="prov">
          <SourceIcon sourceType={item.source_type} />
          {item.provenance_label}
        </div>
      )}
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

      {comments.length > 0 && (
        <div className="comment-thread">
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <span className="comment-author">
                {c.author_email === currentUserEmail ? "You" : authorDisplayName(c.author_email)}
              </span>
              <span className="comment-time">{formatRelativeTime(c.created_at)}</span>
              <p className="comment-body">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <CommentForm itemId={item.id} itemTitle={item.title} />
    </div>
  );
}
