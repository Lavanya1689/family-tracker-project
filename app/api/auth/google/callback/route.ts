import { NextRequest, NextResponse } from "next/server";
import { handleGoogleCallback } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "missing ?code" }, { status: 400 });
  }

  await handleGoogleCallback(code);

  return NextResponse.json({
    ok: true,
    message: "Gmail connected. You can close this tab.",
  });
}
