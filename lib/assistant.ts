import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "./supabase";
import { formatDateInTz, formatTimeInTz } from "./timezone";
import type { Item, Kid } from "./types";

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenerativeAI(key);
  }
  return client;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// Serializes every still-open item (needs_attention + scheduled) into
// plain text for the prompt — small enough volume (tens of rows even on a
// busy day) that a full inline dump is simpler and cheaper than a vector
// search, same reasoning lib/gemini.ts already uses for extraction.
async function buildContext(): Promise<string> {
  const db = supabaseAdmin();
  const [{ data: items }, { data: kids }] = await Promise.all([
    db.from("items").select("*").neq("status", "handled").order("due_at", { ascending: true, nullsFirst: false }),
    db.from("kids").select("*"),
  ]);

  const kidById = new Map(((kids ?? []) as Kid[]).map((k) => [k.id, k.name]));

  const lines = ((items ?? []) as Item[]).map((item) => {
    const kidName = item.kid_id ? kidById.get(item.kid_id) ?? "unknown" : "unassigned";
    const when = item.starts_at
      ? `${formatDateInTz(item.starts_at)} ${item.all_day ? "" : formatTimeInTz(item.starts_at)}`
      : item.due_at
        ? `due ${formatDateInTz(item.due_at)}`
        : "no date";
    return `- [${item.status}] (${item.kind}${item.category ? `/${item.category}` : ""}) "${item.title}" — ${kidName} — ${when}${item.description ? ` — ${item.description}` : ""}`;
  });

  const kidsLine = ((kids ?? []) as Kid[]).map((k) => `${k.name}${k.context ? ` (${k.context})` : ""}`).join(", ");

  // Without this, "today"/"this week" are meaningless to the model — it
  // has no other way to know the current date, and the server's own
  // clock is UTC (Vercel), not the family's timezone.
  const today = formatDateInTz(new Date(), undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return `Today's date is ${today}.

Kids in this family: ${kidsLine || "none configured"}

Current items (needs_attention or scheduled, i.e. not yet handled):
${lines.length > 0 ? lines.join("\n") : "(none — everything is caught up)"}`;
}

const SYSTEM_INSTRUCTIONS = `You are Nestly's assistant, answering a parent's questions about their
family's schedule, deadlines, and to-dos using ONLY the item data provided
below. Be concise and specific — reference actual titles/dates from the
data, don't be vague.

You are read-only: you cannot mark anything done, add anything to the
calendar, schedule anything, or change any data. If asked to do any of
that, say so plainly and suggest doing it from the Today or Schedule page
instead — never claim to have done something you can't actually do.

If the data doesn't answer the question, say that plainly rather than
guessing or inventing details.`;

export async function askAssistant(messages: ChatMessage[]): Promise<string> {
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    throw new Error("Expected the last message to be from the user");
  }

  const context = await buildContext();
  const model = getClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction: `${SYSTEM_INSTRUCTIONS}\n\n${context}`,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const latest = messages[messages.length - 1].text;

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(latest);
  return result.response.text();
}
