import webpush from "web-push";
import { supabaseAdmin } from "./supabase";

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not set");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Sends to every subscribed device (each parent's phone). A dead
// subscription (410/404) is removed rather than retried.
export async function sendPushToAll(payload: PushPayload) {
  configureWebPush();
  const db = supabaseAdmin();
  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) throw error;

  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("push send failed", err);
        }
      }
    })
  );
}
