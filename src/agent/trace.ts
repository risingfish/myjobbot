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

/** Creates a Trace that prints each timestamped event as one JSON line through a writer, named by its stream, so a container's log shows it. */
export function lineTrace(write: (line: string) => void, stream: string, runId: string): Trace {
    return { write: (event) => write(`${JSON.stringify({ at: new Date().toISOString(), run_id: runId, stream, ...event })}\n`) };
}

/** Creates a Trace that writes every event to each of the traces given. */
export function teeTrace(...traces: Trace[]): Trace {
    return { write: (event) => traces.forEach((trace) => trace.write(event)) };
}

/** Wraps a Trace so every event it writes carries the given fields, such as the job a lookup is for. */
export function taggedTrace(trace: Trace, fields: TraceEvent): Trace {
    return { write: (event) => trace.write({ ...fields, ...event }) };
}
