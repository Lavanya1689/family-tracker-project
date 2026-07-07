import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { ExtractedItem } from "./types";
import type { KidConfig } from "./env";

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
}

// Cheap pre-filter so we skip calling Gemini on emails that are obviously
// not actionable (e.g. auto-generated "you're all caught up" notices).
export function looksSkippable(email: EmailForExtraction): boolean {
  return email.body.trim().length < 20;
}

export async function extractItems(
  email: EmailForExtraction,
  kids: KidConfig[]
): Promise<ExtractedItem[]> {
  const model = getClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const kidsContext = kids
    .map((k) => `- ${k.name}: ${k.context}`)
    .join("\n");

  const prompt = `You extract calendar events, deadlines, and action items from a single
school/daycare email for a family organizer app. Only extract things a parent
actually needs to act on or know about — skip greetings, boilerplate, and
marketing filler.

Kids in this family (attribute each item to one if the email indicates who it's about):
${kidsContext || "(none configured)"}

Rules:
- "event" = something happening at a specific time (field trip, party, class).
- "deadline" = something due by a date/time (permission slip, RSVP, payment).
- "action_item" = something the parent must do with no hard deadline mentioned.
- Use ISO 8601 datetimes for starts_at/ends_at/due_at. If only a date is given
  with no time, set all_day true and omit the time-of-day fields.
- If the year is not stated, infer it from the email's received date: ${email.receivedAt.toISOString()}.
- Return an empty items array if nothing actionable is in the email.

Email subject: ${email.subject}
Email sender: ${email.sender}
Email body:
"""
${email.body.slice(0, 12000)}
"""`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());
  return Array.isArray(parsed.items) ? parsed.items : [];
}
