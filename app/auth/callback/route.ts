import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getAllowedEmails } from "@/lib/supabase-server";

// Exchanges the Google OAuth code for a session, then enforces the
// household allowlist — Supabase Auth alone will happily sign in *any*
// Google account, so this is the only thing standing between "logged in"
// and "logged in as someone outside the family". Not allowlisted -> signed
// back out immediately, no session left behind.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const allowed = getAllowedEmails();
  if (!allowed.includes(data.user.email.toLowerCase())) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  return NextResponse.redirect(origin);
}
