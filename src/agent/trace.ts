import { appendFileSync } from "node:fs";

export type TraceEvent = Record<string, unknown>;

export interface Trace {
  write(event: TraceEvent): void;
}

/** Creates a Trace that appends timestamped JSONL events to a file for later debugging and auditing. */
export function fileTrace(path: string, runId: string): Trace {
  return {
    write: (event) => appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), run_id: runId, ...event })}\n`),
  };
}
