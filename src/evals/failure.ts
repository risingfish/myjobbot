import type { AgentResult } from "../agent/loop.js";
import type { Result } from "./format.js";

const WALL_CLOCK = "wall-clock budget exhausted";
const MODEL_ERROR = "LLM error:";

export interface Tally {
    recorded: boolean;
    calls: number;
    failures: number;
}

/** Names why an attempt saved no score, from how its session ended and its record_matches calls, or null when it saved one. */
export function failureOf(result: AgentResult, tally: Tally): Result["failure"] {
    if (tally.recorded) return null;
    if (result.reason.startsWith(MODEL_ERROR)) return "model_error";
    if (result.reason === WALL_CLOCK) return "timed_out";
    return tally.calls > 0 && tally.failures === tally.calls ? "invalid_tool_call" : "no_record";
}
