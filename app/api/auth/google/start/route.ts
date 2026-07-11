import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google";

// Visit this route in a browser once per Google account to grant Gmail
// readonly access. Not linked from the UI — a one-time setup step per
// parent, not a user-facing flow. Pass ?label=Name to tag whose inbox this
// is (e.g. /api/auth/google/start?label=Harsha) — each parent must be
// logged into their own Google account in the browser when visiting this.
export async function GET(req: NextRequest) {
  const label = req.nextUrl.searchParams.get("label") ?? undefined;
  return NextResponse.redirect(getGoogleAuthUrl(label));
}
