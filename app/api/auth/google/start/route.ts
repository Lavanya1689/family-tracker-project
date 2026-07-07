import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google";

// Visit this route in a browser once to grant Gmail readonly access.
// Not linked from the UI — it's a one-time setup step, not a user-facing flow.
export async function GET() {
  return NextResponse.redirect(getGoogleAuthUrl());
}
