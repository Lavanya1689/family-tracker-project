import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

const INVITE_COOKIE = "nestly_invite_token";

// Exchanges the Google OAuth code for a session, then figures out which
// household (if any) this account belongs to — Supabase Auth alone will
// happily sign in *any* Google account, membership is what actually gates
// access to a specific family's data. Three outcomes: already a member ->
// straight in; arrived via a valid invite link (INVITE_COOKIE, set by
// /invite/[token]) -> joins that household now; neither -> /onboarding to
// create a new one. Nobody gets silently rejected anymore — an unrecognized
// account just becomes a new household's first member.
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
  const email = data.user.email;

  const db = supabaseAdmin();
  const { data: membership, error: membershipError } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_email", email)
    .maybeSingle();
  if (membershipError) throw membershipError;

  if (membership) {
    return NextResponse.redirect(origin);
  }

  const inviteToken = req.cookies.get(INVITE_COOKIE)?.value;
  if (inviteToken) {
    const { data: invite, error: inviteError } = await db
      .from("household_invitations")
      .select("id, household_id")
      .eq("token", inviteToken)
      .is("accepted_at", null)
      .maybeSingle();
    if (inviteError) throw inviteError;

    if (invite) {
      const { error: joinError } = await db
        .from("household_members")
        .insert({ household_id: invite.household_id, user_email: email });
      if (joinError) {
        // Someone else's email already claimed household_members' one-row-
        // per-user uniqueness in the moment between check and insert, or
        // this email is already in a different household (one-household-
        // per-user rule) — either way, don't silently drop them in.
        await supabase.auth.signOut();
        const res = NextResponse.redirect(`${origin}/login?error=invite_failed`);
        res.cookies.delete(INVITE_COOKIE);
        return res;
      }
      await db
        .from("household_invitations")
        .update({ accepted_by: email, accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      const res = NextResponse.redirect(origin);
      res.cookies.delete(INVITE_COOKIE);
      return res;
    }
    // Invalid/already-used token — fall through to onboarding rather than
    // erroring; clear the stale cookie either way.
  }

  const res = NextResponse.redirect(`${origin}/onboarding`);
  res.cookies.delete(INVITE_COOKIE);
  return res;
}
