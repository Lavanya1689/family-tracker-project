import { NextRequest, NextResponse } from "next/server";

// Guards the Today view with HTTP Basic Auth. Phase 1 has no login system —
// this is the minimum needed to keep kid names and schedules off the open
// internet once deployed. API routes are excluded: /api/feed is protected by
// its own token, /api/cron by CRON_SECRET, and the rest aren't browsed to.
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next(); // unset locally; required in prod

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const [reqUser, reqPass] = decoded.split(":");
    if (reqUser === user && reqPass === pass) {
      return NextResponse.next();
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
