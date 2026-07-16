"use client";

import { useState, useEffect } from "react";
import type { ItemComment } from "@/lib/comments";
import { authorDisplayName, extractMentionTokens } from "@/lib/comment-format";
import { formatRelativeTime } from "@/lib/format";
import { CommentForm } from "./CommentForm";
import { deleteComment } from "../actions";

// Splits a comment body into plain text and highlighted "@name" spans, for
// every @token that actually matches a real household member (so a stray
// "@" — an email address someone pasted in, say — is left as plain text).
function renderCommentBody(body: string, memberNames: Set<string>) {
  const tokens = extractMentionTokens(body);
  if (tokens.length === 0 || ![...tokens].some((t) => memberNames.has(t.toLowerCase()))) {
    return body;
  }
  const parts = body.split(/(@[a-zA-Z0-9_.+-]+)/g);
  return parts.map((part, i) => {
    const isMention = part.startsWith("@") && memberNames.has(part.slice(1).toLowerCase());
    return isMention ? (
      <span className="mention" key={i}>
        {part}
      </span>
    ) : (
      part
    );
  });
}

export function CommentPanel({
  itemId,
  itemTitle,
  comments,
  currentUserEmail,
  memberEmails = [],
}: {
  itemId: string;
  itemTitle: string;
  comments: ItemComment[];
  currentUserEmail: string;
  // Every household member's email (including the current user) — used to
  // both power the @mention autocomplete (self excluded) and to decide
  // which @tokens in past comments get highlighted.
  memberEmails?: string[];
}) {
  const [open, setOpen] = useState(false);
  const memberNames = new Set(memberEmails.map((e) => authorDisplayName(e).toLowerCase()));

  // Esc closes it too, matching normal modal behavior.
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
      <button type="button" className="comment-trigger" onClick={() => setOpen(true)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
        {comments.length === 0 ? "Comment" : `${comments.length} message${comments.length === 1 ? "" : "s"}`}
      </button>

      {open && (
        <div className="comment-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comment-modal-head">
              <p className="comment-modal-title">{itemTitle}</p>
              <button type="button" className="comment-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="comment-modal-body">
              {comments.length === 0 && <p className="comment-empty">No comments yet — say something.</p>}
              {comments.map((c) => (
                <div className="comment" key={c.id}>
                  <div className="comment-row">
                    <span className="comment-author">
                      {c.author_email === currentUserEmail ? "You" : authorDisplayName(c.author_email)}
                    </span>
                    <span className="comment-time">{formatRelativeTime(c.created_at)}</span>
                    {c.author_email === currentUserEmail && (
                      <form action={deleteComment} className="comment-delete-form">
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="comment-delete" aria-label="Delete comment">
                          ✕
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="comment-body">{renderCommentBody(c.body, memberNames)}</p>
                </div>
              ))}
            </div>
            <CommentForm
              itemId={itemId}
              itemTitle={itemTitle}
              memberEmails={memberEmails.filter((e) => e !== currentUserEmail)}
            />
          </div>
        </div>
      )}
    </>
  );
}
