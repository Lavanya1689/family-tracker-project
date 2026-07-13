// Small visual language for item categories — a quick-scan glyph next to
// the title so "school permission slip" and "daycare tuition notice" read
// differently at a glance, not just by their text. Falls back to a neutral
// pin glyph for categories Gemini didn't set or that don't match a known
// bucket (category is free text, not a DB enum).
export function CategoryIcon({ category }: { category: string | null }) {
  const normalized = category?.toLowerCase() ?? "";

  if (normalized === "school") {
    return (
      <span className="cat-icon school" title="School">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
        </svg>
      </span>
    );
  }

  if (normalized === "daycare") {
    return (
      <span className="cat-icon" title="Daycare">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 21V9l8-5 8 5v12" />
          <path d="M9 21v-6h6v6" />
        </svg>
      </span>
    );
  }

  if (normalized === "activity") {
    return (
      <span className="cat-icon activity" title="Activity">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      </span>
    );
  }

  return (
    <span className="cat-icon" title={category ?? "Event"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a5 5 0 015 5c0 3-5 12-5 12S7 10 7 7a5 5 0 015-5z" />
        <circle cx="12" cy="7" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
