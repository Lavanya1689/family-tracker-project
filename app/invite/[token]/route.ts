import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const INVITE_COOKIE = "nestly_invite_token";

// Validates the invite token, stashes it in a short-lived cookie, then
// sends the visitor into the normal Google sign-in flow — /auth/callback
// reads this cookie to know which household to join instead of creating
// a new one. Doesn't touch household_members itself; that only happens
// once we know who actually signed in.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = req.nextUrl.origin;

  const db = supabaseAdmin();
  const { data: invite, error } = await db
    .from("household_invitations")
    .select("id")
    .eq("token", token)
    .is("accepted_at", null)
    .maybeSingle();
  if (error) throw error;

  if (!invite) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`);
  }

  const res = NextResponse.redirect(`${origin}/login?invite=1`);
  res.cookies.set(INVITE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 30, // 30 minutes is plenty to complete a Google sign-in
    path: "/",
  });
  return res;
}
