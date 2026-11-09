import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";

export function withOwner(makeStores: MakeStores, check: (stores: TestStores) => Promise<void>) {
    return async () => {
        const stores = await makeStores();
        try {
            await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "old" }, NOW);
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}

async function passwordSet({ methods }: TestStores): Promise<void> {
    await methods.setPassword(OWNER_ID, "new", NOW);
    expect(await methods.passwordDigest(OWNER_ID)).toBe("new");
    expect(await methods.passwordDigest(99)).toBeNull();
}

async function fourWaysListed({ methods }: TestStores): Promise<void> {
    expect(await methods.methods(OWNER_ID)).toEqual([
        { kind: "password", enabled: true, ready: true },
        { kind: "email_link", enabled: false, ready: false },
        { kind: "hardware_key", enabled: false, ready: false },
        { kind: "authenticator", enabled: false, ready: false },
    ]);
    expect(await methods.setEnabled(OWNER_ID, { kind: "authenticator", enabled: true, mailOn: true }, NOW)).toBe("ok");
    expect((await methods.methods(OWNER_ID))[3]).toEqual({ kind: "authenticator", enabled: true, ready: false });
}

async function lastWayKept({ methods }: TestStores): Promise<void> {
    expect(await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: true }, NOW)).toBe("last_way");
    expect(await methods.setEnabled(OWNER_ID, { kind: "email_link", enabled: true, mailOn: true }, NOW)).toBe("ok");
    expect(await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: false }, NOW)).toBe("last_way");
    const both = await Promise.all(["password", "email_link"].map((kind) => methods.setEnabled(OWNER_ID, { kind: kind as "password" | "email_link", enabled: false, mailOn: true }, NOW)));
    expect(both.sort()).toEqual(["last_way", "ok"]);
    expect((await methods.methods(OWNER_ID)).filter((row) => row.enabled && row.ready)).toHaveLength(1);
}

export function methodContract(makeStores: MakeStores): void {
    methodStrictCases(makeStores);
    test("setting a password enables and readies password sign-in with the new digest", withOwner(makeStores, passwordSet));
    test("an account lists all four ways, absent ones off and not set up, and ticking one not set up leaves it unusable", withOwner(makeStores, fourWaysListed));
}

export function methodStrictCases(makeStores: MakeStores): void {
    test("a change that would leave no usable way is refused, email links counting only with mail on, even when two run at once", withOwner(makeStores, lastWayKept));
}
