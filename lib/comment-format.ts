// Split out from lib/comments.ts on purpose: that file imports
// supabaseAdmin (pulls in the Node-only `ws` package via lib/supabase.ts),
// which breaks if bundled into a client component. This file has zero
// server dependencies, so it's safe to import from client code.

// Shown next to a comment instead of the full address — "lavanya", not
// "lavanyatangati@gmail.com" — plenty to tell two parents apart.
export function authorDisplayName(email: string): string {
  return email.split("@")[0];
}
