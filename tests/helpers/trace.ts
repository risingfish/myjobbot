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
