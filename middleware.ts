import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Guards every page with a real Supabase session (Google sign-in,
// allowlisted — see app/auth/callback/route.ts). Replaces the old HTTP
// Basic Auth: a standalone iOS PWA has no UI to answer a 401 challenge,
// which forced a delete-and-reinstall cycle just to re-authenticate. A
// session cookie set via a real /login page has no such problem — it's
// just a cookie, refreshed here on every request like any Supabase app.
//
// /api routes are excluded: /api/feed is protected by its own token,
// /api/cron by CRON_SECRET, and the rest aren't browsed to. /login and
// /auth are excluded so the redirect below can't loop. /invite must be
// reachable *before* sign-in too — it's how a brand-new person accepts an
// invitation, so requiring a session first defeats the whole point (this
// exact bug sent an invited user straight to /login without ever setting
// the invite cookie /invite/[token]/route.ts needs to set).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next|login|auth|invite|manifest.json|icons|sw.js).*)"],
};
