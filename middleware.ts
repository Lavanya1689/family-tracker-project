import { NextRequest, NextResponse } from "next/server";

// Guards the Today view with HTTP Basic Auth. Phase 1 has no login system —
// this is the minimum needed to keep kid names and schedules off the open
// internet once deployed. API routes are excluded: /api/feed is protected by
// its own token, /api/cron by CRON_SECRET, and the rest aren't browsed to.
//
// iOS standalone PWAs (added to home screen) don't reliably keep the browser's
// cached Basic Auth credentials across launches — each open can re-trigger the
// 401 challenge, which has no UI in standalone mode, forcing a delete-and-
// re-add-to-home-screen cycle (and losing the push subscription each time).
// So once Basic Auth succeeds, we also set a long-lived cookie and accept
// that on future requests — cookies persist fine in standalone PWAs, unlike
// the Basic Auth credential cache.
const SESSION_COOKIE = "nestly_session";

// Middleware runs on the Edge Runtime, which has no Node `crypto` module —
// only the Web Crypto API (globalThis.crypto.subtle), so this hashes async.
async function sessionValue(pass: string): Promise<string> {
  const data = new TextEncoder().encode(pass);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next(); // unset locally; required in prod

  const expected = await sessionValue(pass);
  if (req.cookies.get(SESSION_COOKIE)?.value === expected) {
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const [reqUser, reqPass] = decoded.split(":");
    if (reqUser === user && reqPass === pass) {
      const res = NextResponse.next();
      res.cookies.set(SESSION_COOKIE, expected, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
      return res;
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Nestly"' },
  });
}

export const config = {
  matcher: ["/((?!api|_next|manifest.json|icons|sw.js).*)"],
};
