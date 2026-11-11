import type { Trace, TraceEvent } from "../agent/trace.js";
import { TALLY_EVENTS, type TallyTotals } from "./tallyEvents.js";

/** A trace that counts what a run part did from the events it already traces, reading only counts and fixed values. */
export class RunTally implements Trace {
    private readonly counts: TallyTotals = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };

    /** Adds one traced event to the totals when it is an event that is counted and its fields parse. */
    write(event: TraceEvent): void {
        const counted = typeof event.type === "string" ? TALLY_EVENTS.get(event.type) : undefined;
        const parsed = counted?.schema.safeParse(event);
        if (counted !== undefined && parsed?.success === true) counted.count(parsed.data, this.counts);
    }

    /** Gives the totals counted so far. */
    totals(): TallyTotals {
        return { ...this.counts };
    }
}
