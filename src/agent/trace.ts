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

/** Wraps a Trace so every event it writes carries the given fields, such as the job a lookup is for. */
export function taggedTrace(trace: Trace, fields: TraceEvent): Trace {
    return { write: (event) => trace.write({ ...fields, ...event }) };
}
