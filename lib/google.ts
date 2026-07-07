import { google } from "googleapis";
import { supabaseAdmin } from "./supabase";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

function newOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

export function getGoogleAuthUrl() {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // force a refresh_token even on repeat authorizations
    scope: SCOPES,
  });
}

// Exchanges the OAuth callback code for tokens and persists the refresh
// token so cron jobs can read Gmail without a user present.
export async function handleGoogleCallback(code: string) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned — revoke prior access at https://myaccount.google.com/permissions and try again"
    );
  }

  const db = supabaseAdmin();
  const { error } = await db.from("oauth_tokens").upsert({
    provider: "google",
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expires_at: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Returns an OAuth2 client loaded with the stored refresh token, ready to
// call the Gmail API. googleapis handles the access-token refresh itself.
async function getAuthorizedClient() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_tokens")
    .select("refresh_token")
    .eq("provider", "google")
    .single();

  if (error || !data) {
    throw new Error(
      "Google not connected yet — visit /api/auth/google/start to authorize Gmail access"
    );
  }

  const client = newOAuthClient();
  client.setCredentials({ refresh_token: data.refresh_token });
  return client;
}

export interface FetchedEmail {
  gmailMessageId: string;
  sender: string;
  subject: string;
  receivedAt: Date;
  body: string; // plain-text body, used only in-memory for extraction — never stored
}

// Fetches messages from the last `days` days, restricted server-side to
// WATCH_SENDERS via the Gmail search query (belt) and re-checked by the
// caller against the allowlist (suspenders).
export async function fetchRecentEmails(
  watchSenders: string[],
  days: number
): Promise<FetchedEmail[]> {
  if (watchSenders.length === 0) return [];

  const auth = await getAuthorizedClient();
  const gmail = google.gmail({ version: "v1", auth });

  const fromClause = watchSenders.map((s) => `from:${s}`).join(" OR ");
  const query = `(${fromClause}) newer_than:${days}d`;

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messages = list.data.messages ?? [];
  const results: FetchedEmail[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = full.data.payload?.headers ?? [];
    const sender = headers.find((h) => h.name === "From")?.value ?? "";
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
    const dateHeader = headers.find((h) => h.name === "Date")?.value;
    const receivedAt = dateHeader ? new Date(dateHeader) : new Date();

    results.push({
      gmailMessageId: msg.id,
      sender,
      subject,
      receivedAt,
      body: extractPlainText(full.data.payload),
    });
  }

  return results;
}

function extractPlainText(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);

    const html = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));

    // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }

  return "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
