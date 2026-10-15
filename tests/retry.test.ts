import { expect, test } from "vitest";
import { withRetry } from "../src/db/retry.js";

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
