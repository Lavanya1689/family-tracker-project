"use client";

import { useState, useEffect } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function EnableNotifications() {
  // Starts "checking" rather than "idle" — without this, the button always
  // renders on first paint even when already subscribed (state was never
  // persisted across reloads, just held in memory), so it looked broken
  // every time the app reopened despite notifications actually working.
  const [status, setStatus] = useState<"checking" | "idle" | "enabling" | "enabled" | "error">("checking");

  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      if (!("serviceWorker" in navigator) || Notification.permission !== "granted") {
        if (!cancelled) setStatus("idle");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? "enabled" : "idle");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    }
    checkExisting();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setStatus("enabling");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("permission denied");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setStatus("enabled");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  if (status === "enabled" || status === "checking") return null;

  return (
    <button className="btn btn-ghost btn-outline" onClick={enable} disabled={status === "enabling"}>
      {status === "enabling" ? "Enabling…" : "Enable notifications"}
    </button>
  );
}
