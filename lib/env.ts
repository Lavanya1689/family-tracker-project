// Parses the sender allowlist and kid roster out of env vars.
// WATCH_SENDERS gates every Gmail read — nothing outside this list is ever
// fetched or sent to Gemini (see CLAUDE.md hard rules).

export function getWatchSenders(): string[] {
  return (process.env.WATCH_SENDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

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

export function senderIsWatched(fromHeader: string, watchSenders: string[]): boolean {
  const from = fromHeader.toLowerCase();
  return watchSenders.some((domainOrAddress) => from.includes(domainOrAddress));
}

// Parent names for task assignment on the Lists screen — e.g. "Lav,Pratik".
export function getParents(): string[] {
  return (process.env.PARENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
