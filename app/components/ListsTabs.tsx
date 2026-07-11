"use client";

import { useState } from "react";

export interface ListsTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

// Segmented tab switching for a *dynamic* number of tabs (one per
// user-created to-do list, plus the fixed Tasks/Reminders/Handled tabs).
// The rest of the app uses a hidden-radio CSS trick for this since the tab
// count is always fixed there — that trick needs one CSS rule per tab id,
// which can't be generated for a variable, user-controlled list of ids.
// On desktop the .seg bar is hidden entirely (globals.css) and every .sub
// panel is forced visible in a grid, so `active` only matters on mobile.
export function ListsTabs({ tabs }: { tabs: ListsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <>
      <div className="seg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? "active" : ""}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="lists-cols">
        {tabs.map((tab) => (
          <div className={`sub${tab.id === active ? " active" : ""}`} key={tab.id}>
            {tab.content}
          </div>
        ))}
      </div>
    </>
  );
}
