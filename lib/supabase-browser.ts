"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client-side auth client (anon key only — never the service role key).
// Used exclusively for sign-in/sign-out; all data access still goes through
// the server-side admin client in lib/supabase.ts.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
