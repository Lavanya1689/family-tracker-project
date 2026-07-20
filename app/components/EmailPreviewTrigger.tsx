"use client";

import { useState, useEffect } from "react";
import { getEmailPreview, type EmailPreview } from "../actions";
import { formatRelativeTime } from "@/lib/format";

// Wraps a Needs Attention card's title/description so clicking it fetches
// the real email body live from Gmail and shows it in a modal — the whole
// point is not having to leave the app just to read the source. Nothing
// fetched here is ever persisted (see getEmailPreview's comment); the
// "Open in Gmail" fallback link still exists for replying, attachments,
// or if the live fetch fails.
export function EmailPreviewTrigger({
  gmailMessageId,
  fallbackHref,
  children,
}: {
  gmailMessageId: string;
  fallbackHref: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<EmailPreview | { error: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleOpen() {
    setOpen(true);
    if (preview) return; // already fetched once — don't refetch every reopen
    setLoading(true);
    const result = await getEmailPreview(gmailMessageId);
    setPreview(result);
    setLoading(false);
  }

  const hasError = preview && "error" in preview;
  const loaded = preview && !("error" in preview) ? preview : null;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="email-preview-trigger"
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        {children}
      </div>

      {open && (
        <div className="comment-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comment-modal-head">
              <p className="comment-modal-title">
                {loading ? "Loading…" : loaded ? loaded.subject : "Couldn't load email"}
              </p>
              <button type="button" className="comment-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="comment-modal-body">
              {loading && <p className="comment-empty">Loading email…</p>}
              {!loading && hasError && <p className="comment-empty">{(preview as { error: string }).error}</p>}
              {!loading && loaded && (
                <>
                  <p className="email-preview-meta">
                    {loaded.sender} · {formatRelativeTime(loaded.receivedAt)}
                  </p>
                  <p className="email-preview-text">{loaded.body || "(no readable text in this email)"}</p>
                  {loaded.attachmentNames.length > 0 && (
                    <p className="email-preview-attachments">
                      📎 {loaded.attachmentNames.join(", ")} — open in Gmail to view
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="comment-form" style={{ justifyContent: "flex-end" }}>
              <a
                href={fallbackHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-outline"
              >
                Open in Gmail
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
