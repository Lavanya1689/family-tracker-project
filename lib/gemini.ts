import { GoogleGenerativeAI, SchemaType, type ResponseSchema, type Part } from "@google/generative-ai";
import type { ExtractedItem } from "./types";
import type { KidConfig } from "./env";
import type { EmailAttachment } from "./google";

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          kind: {
            type: SchemaType.STRING,
            enum: ["event", "deadline", "action_item"],
          },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          kid_name: { type: SchemaType.STRING },
          starts_at: { type: SchemaType.STRING },
          ends_at: { type: SchemaType.STRING },
          all_day: { type: SchemaType.BOOLEAN },
          due_at: { type: SchemaType.STRING },
        },
        required: ["kind", "title"],
      },
    },
  },
  required: ["items"],
};

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenerativeAI(key);
  }
  return client;
}

interface EmailForExtraction {
  subject: string;
  sender: string;
  receivedAt: Date;
  body: string;
  attachments?: EmailAttachment[];
}

// Cheap pre-filter so we skip calling Gemini on emails that are obviously
// not actionable (e.g. auto-generated "you're all caught up" notices).
export function looksSkippable(email: EmailForExtraction): boolean {
  return email.body.trim().length < 20;
}

export async function extractItems(
  email: EmailForExtraction,
  kids: KidConfig[],
  customInstructions?: string | null
): Promise<ExtractedItem[]> {
  const model = getClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      // Attachments (PDFs/images) can produce much richer output than plain
      // email text — the default ceiling truncated a real response mid-JSON
      // during testing. Set explicitly rather than trust the default.
      maxOutputTokens: 8192,
    },
  });

  const kidsContext = kids
    .map((k) => `- ${k.name}: ${k.context}`)
    .join("\n");

  const prompt = `You extract calendar events, deadlines, and notable notices from a
single email for a family organizer app. The email could be from school,
daycare, an activity, the HOA, or any other source relevant to running a
household. Err on the side of extracting — a parent would rather see
something they already knew than miss something that mattered. Only skip
pure marketing/promotional content, automated receipts with nothing to
act on or know, and greetings/boilerplate with no substance.

Kids in this family (attribute each item to one if the email indicates who it's about):
${kidsContext || "(none configured)"}

Rules:
- "event" = something happening at a specific time (field trip, party, class).
- "deadline" = something due by a date/time (permission slip, RSVP, payment).
- "action_item" = anything else worth knowing or doing — a required action,
  a policy/rule change, a general notice or announcement relevant to the
  family or household (e.g. an HOA notice that "architectural modifications
  require board approval," a community safety notice, a schedule change).
  Extract these even when there's no specific action required right now —
  being aware of it is reason enough.
- For starts_at/ends_at/due_at, use the format YYYY-MM-DDTHH:mm:ss with NO
  timezone suffix — no "Z", no "+00:00", nothing. Write the wall-clock time
  exactly as stated in the email (e.g. "10:30 AM" -> "2026-07-08T10:30:00").
  Never convert it to another timezone. If only a date is given with no time,
  set all_day true and omit the time-of-day fields (date only, no "T...").
- If no date is stated outright but the email implies a reasonable timeframe
  (e.g. "before school starts Aug 17" -> due a few days prior; "bring this
  Friday" -> due that Friday; "this week" -> due at the end of that week),
  infer a specific due_at from that context instead of leaving it blank.
  Only omit due_at/starts_at entirely when there's truly no temporal signal
  anywhere in the email to reason from.
- If the year is not stated, infer it from the email's received date: ${email.receivedAt.toISOString()}.
- If the email body references an attached file (flyer, form, PDF) for the
  actual details, and that file is included below, read it and extract the
  real dates/specifics from it — don't just note "an attachment was sent."
  If no attachment is included but one is referenced, fall back to a generic
  action_item noting what the attachment is about so the parent knows to
  check it themselves.
- Return an empty items array if nothing actionable is in the email.
${
  customInstructions
    ? `\nAdditional instructions from this family, on top of everything above (these refine judgment, they don't replace the core rules — e.g. never store raw bodies, still return valid JSON matching the schema):\n"""\n${customInstructions.slice(0, 2000)}\n"""\n`
    : ""
}
Email subject: ${email.subject}
Email sender: ${email.sender}
Email body:
"""
${email.body.slice(0, 12000)}
"""${email.attachments && email.attachments.length > 0 ? `\n\nAttached files follow — read them for details the email body references.` : ""}`;

  const attachmentParts: Part[] = (email.attachments ?? []).map((a) => ({
    inlineData: { mimeType: a.mimeType, data: a.data },
  }));

  const result = await model.generateContent([{ text: prompt }, ...attachmentParts]);
  const text = result.response.text();
  // Let a malformed/truncated response throw rather than swallowing it into
  // "zero items" — the caller (lib/ingest-gmail.ts) wraps each email in its
  // own try/catch specifically so a failure here skips marking the message
  // processed, and it gets retried next run instead of the item being lost
  // silently forever.
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.items) ? parsed.items : [];
}
