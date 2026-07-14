"use client";

import { useState } from "react";

export function AttentionGroupCard({
  label,
  count,
  quickbar,
  children,
}: {
  label: string;
  count: number;
  // Preview text + bulk action buttons — always visible, collapsed or not.
  quickbar: React.ReactNode;
  // The expanded list of individual items, only rendered when open.
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="attn-group">
      <button type="button" className="attn-group-summary" onClick={() => setOpen((o) => !o)}>
        <svg
          className={`attn-group-chevron${open ? " open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        From: {label}
        <span className="attn-group-count">{count} items</span>
      </button>
      {quickbar}
      {open && <div className="attn-group-items">{children}</div>}
    </div>
  );
}
