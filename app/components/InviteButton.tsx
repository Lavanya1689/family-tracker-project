"use client";

import { useState } from "react";
import { createInviteAction } from "../actions";

export function InviteButton() {
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function generate() {
    setStatus("creating");
    setErrorMessage(null);
    const result = await createInviteAction();
    if ("error" in result) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }
    setLink(`${window.location.origin}/invite/${result.token}`);
    setStatus("idle");
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {!link && (
        <button className="btn btn-primary" onClick={generate} disabled={status === "creating"}>
          {status === "creating" ? "Generating…" : "Invite a member"}
        </button>
      )}
      {link && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" readOnly value={link} className="comment-input" style={{ minWidth: 260 }} />
          <button className="btn btn-ghost btn-outline" onClick={copy} type="button">
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      )}
      {status === "error" && (
        <p style={{ fontSize: 12.5, color: "var(--urgent)", marginTop: 6 }}>{errorMessage}</p>
      )}
      {link && (
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
          Send this link to whoever you want to add — it works once, for one person.
        </p>
      )}
    </div>
  );
}
