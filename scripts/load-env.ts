// Loads .env.local into process.env for standalone scripts run via tsx.
// Node's own `--env-file` flag would do this, but it needs Node 20.6+ —
// this machine (and possibly others running these scripts) is on an
// older Node, so scripts load it themselves instead of depending on that
// flag. Minimal on purpose: this repo's .env.local is plain KEY=VALUE
// lines, no multiline values or quoting to worry about.
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
