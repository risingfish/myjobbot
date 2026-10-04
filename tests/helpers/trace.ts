import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Trace, TraceEvent } from "../../src/agent/trace.js";

export function memoryTrace(): Trace & { events: TraceEvent[] } {
  const events: TraceEvent[] = [];
  return {
    events,
    write: (event) => {
      events.push(event);
    },
  };
}

export function readRunEvents(dataDir: string): TraceEvent[] {
  const runsDir = join(dataDir, "runs");
  const files = readdirSync(runsDir).sort();
  return files.flatMap((file) => readJsonl(join(runsDir, file)));
}

export function latestToolEvent(dataDir: string, name: string): TraceEvent {
  const events = readRunEvents(dataDir);
  const matches = events.filter((event) => event.type === "tool" && event.name === name);
  const last = matches.at(-1);
  if (!last) throw new Error(`no tool event for ${name}`);
  return last;
}

export function readJsonl(path: string): TraceEvent[] {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
