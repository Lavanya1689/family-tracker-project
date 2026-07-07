import { NextRequest, NextResponse } from "next/server";
import { ingestGmail } from "@/lib/ingest-gmail";
import { ingestIcsFeeds } from "@/lib/ingest-ics";

export const maxDuration = 60;

// Triggered by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically for scheduled
// invocations — this rejects any other caller.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [gmail, ics] = await Promise.all([
    ingestGmail(7),
    ingestIcsFeeds(),
  ]);

  return NextResponse.json({ gmail, ics });
}
