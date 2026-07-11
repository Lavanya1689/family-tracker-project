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

// `label` (e.g. "Harsha") rides through as OAuth `state` so the callback
// knows which parent is authorizing without needing them logged into the
// app first — there's no login system, so this is the only way to tag it.
export function getGoogleAuthUrl(label?: string) {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // force a refresh_token even on repeat authorizations
    scope: SCOPES,
    state: label ?? "",
  });
}

// Exchanges the OAuth callback code for tokens, identifies which Google
// account this is via the Gmail profile, and upserts it into
// google_accounts (keyed by email) so more than one inbox can be watched.
export async function handleGoogleCallback(code: string, label?: string) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned — revoke prior access at https://myaccount.google.com/permissions and try again"
    );
  }

  client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress;
  if (!email) throw new Error("Could not read the Gmail account's email address");

  const db = supabaseAdmin();
  const { error } = await db.from("google_accounts").upsert(
    {
      email,
      label: label && label.length > 0 ? label : email.split("@")[0],
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
  if (error) throw error;
  return { email };
}

interface GoogleAccount {
  email: string;
  label: string;
  refresh_token: string;
}

async function getConnectedAccounts(): Promise<GoogleAccount[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("google_accounts").select("email, label, refresh_token");
  if (error) throw error;
  return data ?? [];
}

function getAuthorizedClient(refreshToken: string) {
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// Runs `fn` over `items` with at most `limit` in flight at once — Gmail
// reads are network-bound, so bounded concurrency cuts wall-clock time
// substantially versus a sequential loop without risking rate limits.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface EmailCandidate {
  gmailMessageId: string;
  rfc822MessageId: string | null;
  accountEmail: string;
  accountLabel: string;
  refreshToken: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
  isBulkMail: boolean;
}

// Phase 1: cheap metadata-only pass (no message body) across every
// connected account — enough to decide relevance (sender, subject,
// snippet, List-Unsubscribe) without paying for a full-body fetch on
// every message. `format: metadata` is a much smaller/faster response
// than `format: full`, and this is the only phase that scales with total
// inbox volume rather than with how much is actually actionable.
export async function fetchCandidateEmails(days: number): Promise<EmailCandidate[]> {
  const accounts = await getConnectedAccounts();
  if (accounts.length === 0) return [];

  const results: EmailCandidate[] = [];

  for (const account of accounts) {
    const auth = getAuthorizedClient(account.refresh_token);
    const gmail = google.gmail({ version: "v1", auth });

    const list = await gmail.users.messages.list({
      userId: "me",
      q: `in:inbox newer_than:${days}d`,
      maxResults: 50,
    });

    const messages = (list.data.messages ?? []).filter((m) => m.id);

    const candidates = await mapWithConcurrency(messages, 10, async (msg) => {
      const meta = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date", "Message-ID", "List-Unsubscribe"],
      });

      const headers = meta.data.payload?.headers ?? [];
      const sender = headers.find((h) => h.name === "From")?.value ?? "";
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
      const dateHeader = headers.find((h) => h.name === "Date")?.value;
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
      // The RFC822 Message-ID header is assigned by the sending server and
      // shared across every recipient's copy — unlike Gmail's own message
      // id, which is mailbox-scoped — so it catches the same email landing
      // in more than one connected account (e.g. both parents CC'd).
      const rfc822MessageId = headers.find((h) => h.name === "Message-ID")?.value ?? null;
      // List-Unsubscribe is near-universal on bulk/marketing mail and
      // essentially never present on personal or school email — a much
      // stronger "this is not actionable family mail" signal than any
      // keyword, and it's checked before the keyword filter even runs.
      const isBulkMail = headers.some((h) => h.name === "List-Unsubscribe");

      const candidate: EmailCandidate = {
        gmailMessageId: msg.id!,
        rfc822MessageId,
        accountEmail: account.email,
        accountLabel: account.label,
        refreshToken: account.refresh_token,
        sender,
        subject,
        snippet: meta.data.snippet ?? "",
        receivedAt,
        isBulkMail,
      };
      return candidate;
    });

    results.push(...candidates);
  }

  return results;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: string; // standard base64 — what Gemini's inlineData part expects
}

export interface EmailContent {
  body: string;
  attachments: EmailAttachment[];
}

// Flyers/forms are routinely sent as attachments with no specifics in the
// email body itself (see the martial-arts belt-testing case that motivated
// this) — only PDFs and images are worth the multimodal Gemini call; other
// types (docx, xlsx, ...) aren't reliably readable that way and are skipped.
const ELIGIBLE_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
// Bounds worst-case cost/latency of a single multimodal extraction call —
// not a relevance filter, just a size/count safety cap.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_EMAIL = 3;

interface AttachmentRef {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

function listAttachmentRefs(payload: any, out: AttachmentRef[] = []): AttachmentRef[] {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      attachmentId: payload.body.attachmentId,
      size: payload.body.size ?? 0,
    });
  }
  if (payload.parts) {
    for (const part of payload.parts) listAttachmentRefs(part, out);
  }
  return out;
}

// Phase 2: full-body + attachment fetch for exactly one message — only
// called for candidates that already passed the watched-sender/keyword
// filter, so the expensive part of the pipeline scales with what's
// actually relevant, not with total inbox volume.
export async function fetchEmailContent(
  refreshToken: string,
  gmailMessageId: string
): Promise<EmailContent> {
  const auth = getAuthorizedClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });
  const full = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full",
  });

  const body = extractPlainText(full.data.payload);

  const refs = listAttachmentRefs(full.data.payload)
    .filter(
      (r) =>
        ELIGIBLE_ATTACHMENT_MIME_TYPES.has(r.mimeType) &&
        r.size > 0 &&
        r.size <= MAX_ATTACHMENT_BYTES
    )
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);

  const attachments: EmailAttachment[] = [];
  for (const ref of refs) {
    const att = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: gmailMessageId,
      id: ref.attachmentId,
    });
    if (!att.data.data) continue;
    // Gmail returns attachment bytes as base64url; Gemini's inlineData part
    // expects standard base64.
    const standardBase64 = Buffer.from(att.data.data, "base64url").toString("base64");
    attachments.push({ filename: ref.filename, mimeType: ref.mimeType, data: standardBase64 });
  }

  return { body, attachments };
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
