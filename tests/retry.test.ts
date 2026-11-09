import { expect, test } from "vitest";
import { isDeadlock, withRetry } from "../src/db/retry.js";

function failing(times: number) {
    let calls = 0;
    return async () => {
        calls += 1;
        if (calls <= times) throw new Error(`failure ${calls}`);
        return calls;
    };
}

test("a retried attempt succeeds once a try works, waiting between tries", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    expect(await withRetry(failing(1), { tries: 3, delayMs: 10_000, sleep })).toBe(2);
    expect(waits).toEqual([10_000]);
});

test("a retried attempt gives up after its tries with the last error", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    await expect(withRetry(failing(5), { tries: 3, delayMs: 10_000, sleep })).rejects.toThrow("failure 3");
    expect(waits).toEqual([10_000, 10_000]);
});

test("only a deadlock is retried when the attempt says so, any other failure is thrown at once", async () => {
    let calls = 0;
    const deadlockThenOk = async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("Deadlock found when trying to get lock"), { errno: 1213 });
        return calls;
    };
    const sleep = async () => {};
    expect(await withRetry(deadlockThenOk, { tries: 3, delayMs: 0, sleep, retryable: isDeadlock })).toBe(2);
    await expect(withRetry(failing(1), { tries: 3, delayMs: 0, sleep, retryable: isDeadlock })).rejects.toThrow("failure 1");
});
