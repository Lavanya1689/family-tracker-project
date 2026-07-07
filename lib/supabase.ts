import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// Server-only client. Uses the service role key because this is a
// single-household app with no per-user RLS — never import this from
// client components.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    // Node 20 has no global WebSocket (added in Node 22); the client
    // constructor needs one even though this app never uses realtime.
    realtime: { transport: WebSocket as any },
  });
}
