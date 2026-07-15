"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// router.refresh() re-runs the server components on this route (fresh
// data from Supabase) without a full page reload — so "pull to see if
// anything new landed" doesn't cost a service-worker re-registration or
// losing scroll position, the way location.reload() would.
export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spun, setSpun] = useState(false);

  function refresh() {
    setSpun(true);
    startTransition(() => {
      router.refresh();
    });
    setTimeout(() => setSpun(false), 600);
  }

  return (
    <button
      type="button"
      className="refresh-btn"
      onClick={refresh}
      disabled={isPending}
      aria-label="Refresh"
      title="Refresh"
    >
      <svg
        className={spun || isPending ? "spinning" : ""}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 11-2.64-6.36" />
        <path d="M21 4v6h-6" />
      </svg>
    </button>
  );
}
