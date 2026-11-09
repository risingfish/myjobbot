import { WALL_CLOCK_REASON } from "../agent/budget.js";
import { MODEL_ERROR_PREFIX, type AgentResult } from "../agent/loop.js";
import type { Result } from "./format.js";

export interface Tally {
    recorded: boolean;
    calls: number;
    failures: number;
}

/** Names why an attempt saved no score, from how its session ended and its record_matches calls, or null when it saved one. */
export function failureOf(result: AgentResult, tally: Tally): Result["failure"] {
    if (tally.recorded) return null;
    if (result.reason.startsWith(MODEL_ERROR_PREFIX)) return "model_error";
    if (result.reason === WALL_CLOCK_REASON) return "timed_out";
    return tally.calls > 0 && tally.failures === tally.calls ? "invalid_tool_call" : "no_record";
}
