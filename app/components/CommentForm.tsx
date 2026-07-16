"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { addComment } from "../actions";
import { authorDisplayName } from "@/lib/comment-format";

export function CommentForm({
  itemId,
  itemTitle,
  memberEmails = [],
}: {
  itemId: string;
  itemTitle: string;
  // Other household members (not the current user) — powers the @mention
  // autocomplete. Empty in the (rare) single-member-household case, which
  // just means no suggestions ever show.
  memberEmails?: string[];
}) {
  const [sentAt, formAction, pending] = useActionState<number | null, FormData>(async (_prev, formData) => {
    await addComment(formData);
    return Date.now();
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSent, setShowSent] = useState(false);
  const [value, setValue] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!sentAt) return;
    formRef.current?.reset();
    setValue("");
    setMentionQuery(null);
    setShowSent(true);
    const t = setTimeout(() => setShowSent(false), 2000);
    return () => clearTimeout(t);
  }, [sentAt]);

  const suggestions =
    mentionQuery === null
      ? []
      : memberEmails.filter((email) =>
          authorDisplayName(email).toLowerCase().startsWith(mentionQuery.toLowerCase())
        );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    const cursor = e.target.selectionStart ?? next.length;
    const upToCursor = next.slice(0, cursor);
    // Only offer suggestions for an "@" the user is actively typing right
    // now (no space since it), not any "@" earlier in an already-finished
    // comment.
    const match = upToCursor.match(/@([a-zA-Z0-9_.+-]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function pickMention(email: string) {
    const input = inputRef.current;
    if (!input) return;
    const cursor = input.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const start = upToCursor.search(/@[a-zA-Z0-9_.+-]*$/);
    if (start === -1) return;
    const name = authorDisplayName(email);
    const next = value.slice(0, start) + "@" + name + " " + value.slice(cursor);
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = start + name.length + 2;
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="comment-form">
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="item_title" value={itemTitle} />
      <div className="comment-input-wrap">
        {suggestions.length > 0 && (
          <div className="mention-menu">
            {suggestions.map((email) => (
              <button
                type="button"
                key={email}
                className="mention-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(email);
                }}
              >
                @{authorDisplayName(email)}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          name="body"
          placeholder="Add a comment… (@ to mention someone)"
          className="comment-input"
          disabled={pending}
          required
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMentionQuery(null);
          }}
        />
      </div>
      <button className="btn btn-ghost btn-outline" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
      {showSent && <span className="comment-sent">Sent ✓</span>}
    </form>
  );
}
