"use client";

import { useState } from "react";
import { sendTestNotification } from "../actions";

export function TestNotificationButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function send() {
    setStatus("sending");
    setErrorMessage(null);
    try {
      await sendTestNotification();
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button className="btn btn-ghost btn-outline" onClick={send} disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send test notification"}
      </button>
      {status === "sent" && <span style={{ fontSize: 13, color: "var(--pine)" }}>Sent — check your device</span>}
      {status === "error" && (
        <span style={{ fontSize: 13, color: "#B45309" }}>Failed: {errorMessage}</span>
      )}
    </div>
  );
}
