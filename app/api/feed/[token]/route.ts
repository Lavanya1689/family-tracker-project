import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { generateIcsFeed } from "@/lib/ics";
import type { Item } from "@/lib/types";

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The private, unguessable ICS feed URL parents subscribe to in
// Apple/Google Calendar. Auth is the token itself (path segment), matching
// ICS_PUBLISH_TOKEN — there's no login flow for a calendar subscription.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const expected = process.env.ICS_PUBLISH_TOKEN;
  if (!expected || !tokenMatches(token, expected)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("items")
    .select("*")
    .neq("status", "handled")
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ics = generateIcsFeed((data ?? []) as Item[]);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nestly.ics"',
      "Cache-Control": "public, max-age=900", // 15 min — calendar apps poll infrequently anyway
    },
  });
}
