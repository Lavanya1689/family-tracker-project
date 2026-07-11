import { NextRequest, NextResponse } from "next/server";
import { ingestReminders } from "@/lib/ingest-reminders";

// Separate from /api/cron/sync deliberately: reminders need to fire close
// to their actual time to be useful, while Gmail/ICS sync is fine once a
// day. Vercel's free tier only allows daily cron, so this route is meant
// to be called more often by an external scheduler (e.g. a free GitHub
// Actions cron every 15-30 min) — see the setup checklist for how.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await ingestReminders();
  return NextResponse.json(result);
}
