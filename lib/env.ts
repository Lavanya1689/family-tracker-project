// Parses the kid roster out of env vars.

export interface KidConfig {
  name: string;
  context: string;
}

export function getKidsConfig(): KidConfig[] {
  return (process.env.KIDS ?? "")
    .split(",")
    .map((pair) => {
      const [name, ...rest] = pair.split(":");
      return { name: name?.trim() ?? "", context: rest.join(":").trim() };
    })
    .filter((k) => k.name.length > 0);
}

// Parent names for task assignment on the Lists screen — e.g. "Lav,Pratik".
export function getParents(): string[] {
  return (process.env.PARENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
