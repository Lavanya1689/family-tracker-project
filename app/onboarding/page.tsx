import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentHouseholdId } from "@/lib/household";
import { createHouseholdAction } from "../actions";

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

export default async function OnboardingPage() {
  // Already belongs to a household (e.g. re-visiting this URL directly) —
  // nothing to onboard, just go to Today.
  const existingHouseholdId = await getCurrentHouseholdId();
  if (existingHouseholdId) redirect("/");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
      }}
    >
      <Brand />
      <p className="subgreet" style={{ textAlign: "center", maxWidth: 340 }}>
        {user?.email} isn&apos;t part of a household yet. If someone sent you an invite
        link, use that instead — otherwise, create your family&apos;s space here.
      </p>
      <form
        action={createHouseholdAction}
        style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}
      >
        <input
          type="text"
          name="name"
          placeholder="e.g. The Tangati Family"
          className="comment-input"
          required
          autoFocus
        />
        <button className="btn btn-primary" type="submit">
          Create your family&apos;s Nestly
        </button>
      </form>
    </div>
  );
}
