import { appendFileSync } from "node:fs";

export type TraceEvent = Record<string, unknown>;

export interface Trace {
  write(event: TraceEvent): void;
}

export function fileTrace(path: string): Trace {
  return {
    write: (event) => appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`),
  };
}
