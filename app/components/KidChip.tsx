import type { Kid } from "@/lib/types";

export function KidChip({ kid }: { kid: Pick<Kid, "name" | "color_key"> | null }) {
  if (!kid) return null;
  return (
    <span className={`kid kid-${kid.color_key}`}>
      <span className="dot" />
      {kid.name}
    </span>
  );
}
