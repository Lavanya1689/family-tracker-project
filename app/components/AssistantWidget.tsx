"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

// A floating chat bubble available from anywhere in the app, the way most
// products surface a "hey, ask me something" widget — not a separate page
// you have to navigate to and back from.
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setMessages([...next, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Ask Nestly" : "Ask Nestly"}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="assistant-widget">
          <div className="assistant-widget-head">
            <p className="assistant-widget-title">Ask Nestly</p>
            <button type="button" className="comment-modal-close" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="assistant-messages">
            {messages.length === 0 && (
              <p className="assistant-hint">
                Ask about anything on your plate — &ldquo;what does Vihaan have today?&rdquo;,
                &ldquo;anything overdue?&rdquo;, &ldquo;what&apos;s due for daycare?&rdquo;. Read-only — it can
                answer, not change anything.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`assistant-msg ${m.role}`}>
                <p>{m.text}</p>
              </div>
            ))}
            {loading && (
              <div className="assistant-msg assistant">
                <p className="assistant-thinking">Thinking…</p>
              </div>
            )}
            {error && <p className="assistant-error">{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form
            className="assistant-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nestly…"
              className="assistant-input"
              disabled={loading}
              autoFocus
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
