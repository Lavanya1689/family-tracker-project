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

async function sendToSubscriptions(subs: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: PushPayload) {
  configureWebPush();
  const db = supabaseAdmin();

  await Promise.all(
    subs.map(async (sub) => {
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

// Sends to every subscribed device (each parent's phone). A dead
// subscription (410/404) is removed rather than retried. Used for
// household-wide notices (new items extracted, a reminder firing) where
// everyone should hear about it.
export async function sendPushToAll(payload: PushPayload) {
  const db = supabaseAdmin();
  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) throw error;
  await sendToSubscriptions(subs ?? [], payload);
}

// Sends to every device except the given user's own — e.g. so posting a
// comment notifies the other parent, not yourself. Filtered in JS rather
// than via `.neq("user_email", ...)`: Postgres's <> doesn't match NULL
// rows, so a DB-side filter would silently drop subscriptions with no
// user_email (registered before Supabase Auth existed) instead of
// including them, which is the opposite of the intent.
export async function sendPushToOthers(excludeEmail: string, payload: PushPayload) {
  const db = supabaseAdmin();
  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) throw error;
  const others = (subs ?? []).filter((s) => s.user_email !== excludeEmail);
  await sendToSubscriptions(others, payload);
}
