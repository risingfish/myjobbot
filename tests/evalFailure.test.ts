import { expect, test } from "vitest";
import { failureOf } from "../src/evals/failure.js";

test("an attempt's failure is named from how its session ended, unless it saved a score", () => {
    const ended = (reason: string) => ({ status: "aborted" as const, reason, steps: 3 });
    const none = { recorded: false, calls: 0, failures: 0 };
    expect([failureOf(ended("wall-clock budget exhausted"), { recorded: true, calls: 1, failures: 0 }), failureOf(ended("LLM error: connect ECONNREFUSED"), none), failureOf(ended("wall-clock budget exhausted"), none), failureOf(ended("step budget exhausted"), { recorded: false, calls: 2, failures: 2 }), failureOf(ended("step budget exhausted"), { recorded: false, calls: 2, failures: 1 }), failureOf({ status: "finished", reason: "finish called", steps: 2 }, none)]).toEqual([null, "model_error", "timed_out", "invalid_tool_call", "no_record", "no_record"]);
});
