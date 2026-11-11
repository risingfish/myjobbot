import { APIConnectionError, APIError } from "openai";
import { expect, test } from "vitest";
import { runFailureReason } from "../src/monitoring/failureReason.js";
import { runOutcome } from "../src/monitoring/runStatus.js";

test("a run finished when every part finished or was set aside, and finished with errors otherwise", () => {
    expect(runOutcome(["finished", "skipped", "deleted", "held"])).toBe("finished");
    expect(runOutcome([])).toBe("finished");
    expect(runOutcome(["finished", "stopped"])).toBe("finished_with_errors");
    expect(runOutcome(["failed", "skipped"])).toBe("finished_with_errors");
});

function named(name: string): Error {
    return Object.assign(new Error("text that must never be kept"), { name });
}

test("a failure is kept only as a fixed reason, by what kind of error it was", () => {
    expect(runFailureReason(Object.assign(new Error("Access denied for user"), { sqlState: "28000" }))).toBe("database");
    expect(runFailureReason(new APIError(500, undefined, "boom", new Headers()))).toBe("model");
    expect(runFailureReason(new APIConnectionError({ message: "down" }))).toBe("model");
    expect(runFailureReason(named("TimeoutError"))).toBe("timeout");
    expect(runFailureReason(named("TargetClosedError"))).toBe("browser");
    expect(runFailureReason(new Error("anything"))).toBe("other");
    expect(runFailureReason("a string")).toBe("other");
});
