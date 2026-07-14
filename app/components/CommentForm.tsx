"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { addComment } from "../actions";

export function CommentForm({ itemId, itemTitle }: { itemId: string; itemTitle: string }) {
  const [sentAt, formAction, pending] = useActionState<number | null, FormData>(async (_prev, formData) => {
    await addComment(formData);
    return Date.now();
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showSent, setShowSent] = useState(false);

  useEffect(() => {
    if (!sentAt) return;
    formRef.current?.reset();
    setShowSent(true);
    const t = setTimeout(() => setShowSent(false), 2000);
    return () => clearTimeout(t);
  }, [sentAt]);

  return (
    <form ref={formRef} action={formAction} className="comment-form">
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="item_title" value={itemTitle} />
      <input
        type="text"
        name="body"
        placeholder="Add a comment…"
        className="comment-input"
        disabled={pending}
        required
      />
      <button className="btn btn-ghost btn-outline" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
      {showSent && <span className="comment-sent">Sent ✓</span>}
    </form>
  );
}
