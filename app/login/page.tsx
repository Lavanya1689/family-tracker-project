"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That Google account isn't on Nestly's household allowlist.",
  auth_failed: "Sign-in failed. Please try again.",
};

function Brand() {
  return (
    <div className="brand" style={{ justifyContent: "center", fontSize: 22 }}>
      <svg width="30" height="30" viewBox="0 0 26 26" fill="none">
        <path d="M4 15c0 5 4 8 9 8s9-3 9-8" stroke="#0E4F45" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M7 15c0-1 .5-4 6-4s6 3 6 4" stroke="#0E4F45" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="7" r="2.6" fill="#B45309" />
      </svg>
      Nestly
    </div>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");

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
        Your family, sorted. Sign in with the Google account you use for Nestly.
      </p>
      {errorCode && (
        <p className="attn-body" style={{ color: "#B45309", textAlign: "center", maxWidth: 320 }}>
          {ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again."}
        </p>
      )}
      <button className="btn btn-primary" onClick={signIn} disabled={loading}>
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>
    </div>
  );
}
