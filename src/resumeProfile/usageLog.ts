import type { Trace } from "../agent/trace.js";

/** Wraps the model's response log so it keeps each response's token usage alone, never the text the model answered with. */
export function usageOnlyLog(log: Trace): Trace {
    return {
        write: (event) => {
            const response = event.response;
            const usage = typeof response === "object" && response !== null && "usage" in response ? response.usage : null;
            log.write({ type: event.type, usage });
        },
    };
}
