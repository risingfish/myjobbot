import { expect, test } from "vitest";
import type { AttemptKey } from "../../src/db/attemptStore.js";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";

async function attemptsCountedWithinADay({ attempts }: TestStores): Promise<void> {
    const key: AttemptKey = { kind: "signin_fail", scope: "email", keyDigest: "k" };
    await attempts.recordAttempt(key, "2026-11-04T10:00:00.000Z");
    await attempts.recordAttempt(key, "2026-11-06T09:50:00.000Z");
    await attempts.recordAttempt({ ...key, scope: "address" }, "2026-11-06T09:55:00.000Z");
    await attempts.recordAttempt(key, NOW);
    expect(await attempts.countAttempts(key, "2026-11-06T09:45:00.000Z")).toBe(2);
    expect(await attempts.countAttempts(key, "2026-11-01T00:00:00.000Z")).toBe(2);
    expect(await attempts.countAttempts({ ...key, kind: "mail_request" }, "2026-11-01T00:00:00.000Z")).toBe(0);
}

export function attemptContract(makeStores: MakeStores): void {
    test("attempts are counted per kind, scope and key since a time, and those over a day old are dropped", async () => {
        const stores = await makeStores();
        await attemptsCountedWithinADay(stores);
        await stores.close();
    });
}
