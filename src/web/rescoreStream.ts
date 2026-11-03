import { runEnd, type RescoreRun, type StoredStep } from "../db/rescoreLogStore.js";
import { parseStep, stepLine } from "../rescore/steps.js";

export interface StreamEvent {
    event: "start" | "step" | "end" | "ping";
    id?: number;
    data: unknown;
}

export const PING: StreamEvent = { event: "ping", data: {} };

/** Turns a run and its stored steps into the events the terminal follows: the start, each step's line, and the end once the run has ended or counts as dead. */
export function streamEvents(run: RescoreRun, steps: StoredStep[], now: Date): StreamEvent[] {
    const start: StreamEvent = { event: "start", data: { ats: run.ats, jobId: run.jobId, startedAt: run.startedAt } };
    const end = runEnd(run, now);
    return [start, ...stepEvents(steps), ...(end === null ? [] : [{ event: "end" as const, data: end }])];
}

/** Turns stored steps into step events, leaving out any that don't parse, so only a line built by `stepLine` is sent. */
function stepEvents(steps: StoredStep[]): StreamEvent[] {
    return steps.flatMap((stored) => {
        const step = parseStep(stored.kind, stored.fields);
        return step === null ? [] : [{ event: "step" as const, id: stored.seq, data: { seq: stored.seq, elapsedMs: stored.elapsedMs, line: stepLine(step) } }];
    });
}

/** Writes events in the server-sent events format. */
export function sseText(events: StreamEvent[]): string {
    return events.map(({ event, id, data }) => `${id === undefined ? "" : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}
