import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentHouseholdId } from "@/lib/household";
import { getKidsByHousehold } from "@/lib/kids";
import { createHouseholdAction, addKidAction, deleteKidAction } from "../actions";
import { InviteButton } from "../components/InviteButton";

function Brand() {
  return (
    <div className="brand" style={{ justifyContent: "center", fontSize: 20 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M4 15c0 5 4 8 9 8s9-3 9-8" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M7 15c0-1 .5-4 6-4s6 3 6 4" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="7" r="2.6" fill="var(--urgent)" />
      </svg>
      Nestly
    </div>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="onboard-dots">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`onboard-dot${i + 1 === step ? " active" : i + 1 < step ? " done" : ""}`} />
      ))}
    </div>
  );
}

function OnboardingStep({
  eyebrow,
  title,
  body,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="onboard-step">
      <div className="onboard-icon">{icon}</div>
      <p className="onboard-eyebrow">{eyebrow}</p>
      <h1 className="onboard-title">{title}</h1>
      <p className="onboard-body">{body}</p>
      <div className="onboard-content">{children}</div>
    </div>
  );
}

const ICONS = {
  kids: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M2 21v-1a5 5 0 015-5h2a5 5 0 015 5v1" />
      <path d="M14 15.5a4 4 0 013.5-2h.5a3.5 3.5 0 013.5 3.5V21" />
    </svg>
  ),
  gmail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
      <path d="M17.5 14.5l1.3 1.3 2.2-2.6" />
    </svg>
  ),
  invite: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="9" r="3" />
      <path d="M2 20v-1a5 5 0 015-5h1a5 5 0 015 5v1" />
      <path d="M17 8v6M14 11h6" />
    </svg>
  ),
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const params = await searchParams;
  const householdId = await getCurrentHouseholdId();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No household yet — step 1 (name) is the only reachable step; everything
  // else needs a household to attach to.
  if (!householdId) {
    return (
      <div className="onboard-shell">
        <Brand />
        <StepDots step={1} total={4} />
        <OnboardingStep
          eyebrow="Step 1 of 4"
          title="Set up your family"
          body={`${user?.email ?? "You"} isn't part of a household yet. If someone sent you an invite link, use that instead — otherwise, start your family's space here.`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-8 9 8v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          }
        >
          <form action={createHouseholdAction} className="onboard-form">
            <input type="text" name="name" placeholder="e.g. The Tangati Family" className="comment-input" required autoFocus />
            <button className="btn btn-primary" type="submit">
              Create your family&apos;s Nestly
            </button>
          </form>
        </OnboardingStep>
      </div>
    );
  }

  const step = Number(params.step) === 3 || Number(params.step) === 4 ? Number(params.step) : 2;

  if (step === 2) {
    const kids = await getKidsByHousehold(householdId);
    return (
      <div className="onboard-shell">
        <Brand />
        <StepDots step={2} total={4} />
        <OnboardingStep
          eyebrow="Step 2 of 4"
          title="Add your kids"
          body="Each kid gets their own marker-pen color, used everywhere Nestly shows who something's for. Add as many as you like — you can always add more later from Settings."
          icon={ICONS.kids}
        >
          {kids.length > 0 && (
            <ul className="onboard-kid-list">
              {kids.map((k) => (
                <li key={k.id} className={`kid kid-${k.color_key}`}>
                  <span className="dot" />
                  {k.name}
                  <form action={deleteKidAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="comment-delete" aria-label={`Remove ${k.name}`}>
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addKidAction} className="onboard-form">
            <input type="text" name="name" placeholder="Kid's name" className="comment-input" required />
            <input type="text" name="context" placeholder="School or daycare (optional)" className="comment-input" />
            <button className="btn btn-outline" type="submit">
              Add kid
            </button>
          </form>
          <div className="onboard-actions">
            <Link href="/onboarding?step=3" className="btn btn-primary">
              Continue
            </Link>
          </div>
        </OnboardingStep>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="onboard-shell">
        <Brand />
        <StepDots step={3} total={4} />
        <OnboardingStep
          eyebrow="Step 3 of 4"
          title="Connect your Gmail"
          body="Nestly reads school and daycare emails to pull out events, deadlines, and to-dos automatically — that's the part no other family app does for you. This is entirely optional and per-person: you only ever connect your own inbox, and only your own account decides whether to grant access. Nestly never stores the email body, only the extracted event/deadline details and the message's sender/subject for reference."
          icon={ICONS.gmail}
        >
          <div className="onboard-actions">
            <a
              className="btn btn-primary"
              href={`/api/auth/google/start?label=${encodeURIComponent(user?.email?.split("@")[0] ?? "me")}`}
            >
              Connect Gmail
            </a>
            <Link href="/onboarding?step=4" className="btn btn-ghost btn-outline">
              Skip for now
            </Link>
          </div>
        </OnboardingStep>
      </div>
    );
  }

  return (
    <div className="onboard-shell">
      <Brand />
      <StepDots step={4} total={4} />
      <OnboardingStep
        eyebrow="Step 4 of 4"
        title="Invite your partner"
        body="Send this link to whoever else should see and manage your family's Nestly. They'll sign in with their own Google account and land right in this household — nothing shared, no passwords."
        icon={ICONS.invite}
      >
        <InviteButton />
        <div className="onboard-actions">
          <Link href="/" className="btn btn-primary">
            Finish — take me to Today
          </Link>
        </div>
      </OnboardingStep>
    </div>
  );
}
