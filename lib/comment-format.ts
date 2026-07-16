// Split out from lib/comments.ts on purpose: that file imports
// supabaseAdmin (pulls in the Node-only `ws` package via lib/supabase.ts),
// which breaks if bundled into a client component. This file has zero
// server dependencies, so it's safe to import from client code.

// Shown next to a comment instead of the full address — "lavanya", not
// "lavanyatangati@gmail.com" — plenty to tell two parents apart. Also
// doubles as the @mention token, so "@lavanya" in a comment body matches
// this same name.
export function authorDisplayName(email: string): string {
  return email.split("@")[0];
}

const MENTION_PATTERN = /@([a-zA-Z0-9_.+-]+)/g;

// Every @token in a comment body, regardless of whether it resolves to a
// real household member — used by the client to highlight only the ones
// that do (via resolveMentions) and leave stray "@"s (e.g. an email pasted
// into a comment) alone.
export function extractMentionTokens(body: string): string[] {
  return Array.from(body.matchAll(MENTION_PATTERN)).map((m) => m[1]);
}

// Resolves @name tokens in a comment body against a household's member
// emails (matched by display name, case-insensitive) — the subset that's
// actually mentioned, so a mention notifies only those people instead of
// the default "everyone but the author" broadcast.
export function resolveMentions(body: string, memberEmails: string[]): string[] {
  const tokens = new Set(extractMentionTokens(body).map((t) => t.toLowerCase()));
  if (tokens.size === 0) return [];
  return memberEmails.filter((email) => tokens.has(authorDisplayName(email).toLowerCase()));
}
