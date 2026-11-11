import { expect, test } from "vitest";
import { runExitCode, runLine } from "../src/app/runLines.js";

const finished = { userId: 1, report: { status: "finished" as const, reason: "done", steps: 4, runId: "run-1", summary: null } };

test("each user's line names them by id: the run as before, a skip with its reason, or a failure", () => {
    expect([runLine(finished), runLine({ userId: 2, skipped: "no resume" }), runLine({ userId: 3, failed: "boom", reason: "other" })]).toEqual(["user 1: run run-1 finished after 4 steps: done", "user 2: skipped (no resume)", "user 3: failed"]);
});

test("the exit code is 1 when any user failed or didn't finish, or when the one user asked for was skipped", () => {
    const skipped = { userId: 2, skipped: "no resume" };
    expect(runExitCode([finished, skipped], undefined)).toBe(0);
    expect(runExitCode([finished, { userId: 3, failed: "boom", reason: "other" }], undefined)).toBe(1);
    expect(runExitCode([{ ...finished, report: { ...finished.report, status: "aborted" as const } }], undefined)).toBe(1);
    expect(runExitCode([skipped], 2)).toBe(1);
});

test("a carried-out deletion and a held one get their own lines and don't change the exit code", () => {
    expect([runLine({ userId: 2, deleted: true }), runLine({ userId: 3, held: "last_admin" })]).toEqual(["user 2: deleted", "user 3: deletion held (last admin)"]);
    expect(runExitCode([finished, { userId: 2, deleted: true }, { userId: 3, held: "last_admin" }], undefined)).toBe(0);
});
