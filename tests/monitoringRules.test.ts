import { APIConnectionError, APIError } from "openai";
import { expect, test } from "vitest";
import { runFailureReason } from "../src/monitoring/failureReason.js";
import { failingRepeatedly } from "../src/monitoring/failing.js";
import { periodOf, periodSince } from "../src/monitoring/periods.js";
import { runOutcome, runStatus } from "../src/monitoring/runStatus.js";

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

const NOW = new Date("2026-11-10T12:00:00.000Z");

test("a run with no end is running while it shows signs of life, and never finished after 5 minutes without one", () => {
    expect(runStatus({ endedAt: null, aliveAt: "2026-11-10T11:55:01.000Z", outcome: null }, NOW)).toBe("running");
    expect(runStatus({ endedAt: null, aliveAt: "2026-11-10T11:55:00.000Z", outcome: null }, NOW)).toBe("never_finished");
    expect(runStatus({ endedAt: "2026-11-10T11:00:00.000Z", aliveAt: "2026-11-10T11:00:00.000Z", outcome: "finished_with_errors" }, NOW)).toBe("finished_with_errors");
});

test("a period reaches back 1, 7 or 30 days, and anything else asked for is a week", () => {
    expect((["day", "week", "month"] as const).map((period) => periodSince(period, NOW))).toEqual(["2026-11-09T12:00:00.000Z", "2026-11-03T12:00:00.000Z", "2026-10-11T12:00:00.000Z"]);
    expect([periodOf("day"), periodOf("month"), periodOf("year"), periodOf(["day"]), periodOf(undefined)]).toEqual(["day", "month", "week", "week", "week"]);
});

test("a source fails repeatedly when its latest 3 fetches all failed", () => {
    expect(failingRepeatedly(["failing", "failing", "failing", "ok"])).toBe(true);
    expect(failingRepeatedly(["failing", "failing"])).toBe(false);
    expect(failingRepeatedly(["failing", "skipped", "failing", "failing"])).toBe(false);
});
