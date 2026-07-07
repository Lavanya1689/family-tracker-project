"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function EnableNotifications() {
  const [status, setStatus] = useState<"idle" | "enabling" | "enabled" | "error">("idle");

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

  if (status === "enabled") return null;

  return (
    <button className="btn btn-ghost" onClick={enable} disabled={status === "enabling"}>
      {status === "enabling" ? "Enabling…" : "Enable notifications"}
    </button>
  );
}
