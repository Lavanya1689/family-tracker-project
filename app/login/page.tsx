"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Sign-in failed. Please try again.",
  invalid_invite: "That invite link is invalid or has already been used.",
  invite_failed: "Couldn't complete that invite — the account may already belong to a different household.",
};

function Brand() {
  return (
    <div className="brand" style={{ justifyContent: "center", fontSize: 22 }}>
      <svg width="30" height="30" viewBox="0 0 26 26" fill="none">
        <path d="M4 15c0 5 4 8 9 8s9-3 9-8" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M7 15c0-1 .5-4 6-4s6 3 6 4" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="7" r="2.6" fill="var(--urgent)" />
      </svg>
      Nestly
    </div>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const isInvite = searchParams.get("invite") === "1";

  async function signIn() {
    setLoading(true);
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <Brand />
      <p className="subgreet" style={{ textAlign: "center", maxWidth: 320 }}>
        {isInvite
          ? "You've been invited to join a family on Nestly. Sign in with Google to accept."
          : "Your family, sorted. Sign in with the Google account you use for Nestly."}
      </p>
      {errorCode && (
        <p className="attn-body" style={{ color: "var(--urgent)", textAlign: "center", maxWidth: 320 }}>
          {ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again."}
        </p>
      )}
      <button className="btn btn-primary" onClick={signIn} disabled={loading}>
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>
    </div>
  );
}
