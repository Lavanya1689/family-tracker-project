import { getGeminiCustomInstructions } from "@/lib/settings";
import { updateGeminiInstructions } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const instructions = await getGeminiCustomInstructions();

  return (
    <>
      <h1 className="greeting" style={{ fontSize: 20, marginBottom: 14 }}>
        Settings
      </h1>

      <div className="list-section" style={{ maxWidth: 640 }}>
        <div className="list-section-head">
          <span className="list-section-title">Gemini extraction instructions</span>
        </div>
        <p className="attn-body" style={{ marginBottom: 14 }}>
          This is added on top of Nestly&apos;s built-in extraction rules — use it to
          steer what counts as worth surfacing for your family specifically. It applies
          to every email scanned, across all connected inboxes.
        </p>
        <form action={updateGeminiInstructions}>
          <textarea
            name="instructions"
            defaultValue={instructions ?? ""}
            placeholder={
              'e.g. "Always flag anything mentioning Aanya\'s allergy." or "Ignore newsletters from the PTA unless they mention a deadline."'
            }
            rows={8}
            className="settings-textarea"
          />
          <div className="attn-actions">
            <button className="btn btn-primary" type="submit">
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
