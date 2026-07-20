import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentHouseholdId } from "@/lib/household";
import { askAssistant, GeminiBudgetExhaustedError, type ChatMessage } from "@/lib/assistant";

// Middleware's matcher excludes /api, so this route isn't gated by the
// session-redirect there — check auth here, same as the push-subscribe
// route.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "no household" }, { status: 400 });
  }

  const body = await req.json();
  const messages = body?.messages as ChatMessage[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const reply = await askAssistant(messages, householdId);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof GeminiBudgetExhaustedError) {
      return NextResponse.json(
        { error: "I've hit today's AI usage limit — it resets overnight, try again tomorrow." },
        { status: 429 }
      );
    }
    console.error("assistant request failed", err);
    return NextResponse.json({ error: "Something went wrong answering that." }, { status: 500 });
  }
}
