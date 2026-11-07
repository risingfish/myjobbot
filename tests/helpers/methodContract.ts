import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { Stores } from "../../src/db/store.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";

function withOwner(makeStores: MakeStores, check: (stores: Stores) => Promise<void>) {
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

async function passwordSet({ methods }: Stores): Promise<void> {
    await methods.setPassword(OWNER_ID, "new", NOW);
    expect(await methods.passwordDigest(OWNER_ID)).toBe("new");
    expect(await methods.passwordDigest(99)).toBeNull();
}

async function fourWaysListed({ methods }: Stores): Promise<void> {
    expect(await methods.methods(OWNER_ID)).toEqual([
        { kind: "password", enabled: true, ready: true },
        { kind: "email_link", enabled: false, ready: false },
        { kind: "hardware_key", enabled: false, ready: false },
        { kind: "authenticator", enabled: false, ready: false },
    ]);
    expect(await methods.setEnabled(OWNER_ID, { kind: "authenticator", enabled: true, mailOn: true }, NOW)).toBe("ok");
    expect((await methods.methods(OWNER_ID))[3]).toEqual({ kind: "authenticator", enabled: true, ready: false });
}

async function lastWayKept({ methods }: Stores): Promise<void> {
    expect(await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: true }, NOW)).toBe("last_way");
    expect(await methods.setEnabled(OWNER_ID, { kind: "email_link", enabled: true, mailOn: true }, NOW)).toBe("ok");
    expect(await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: false }, NOW)).toBe("last_way");
    const both = await Promise.all(["password", "email_link"].map((kind) => methods.setEnabled(OWNER_ID, { kind: kind as "password" | "email_link", enabled: false, mailOn: true }, NOW)));
    expect(both.sort()).toEqual(["last_way", "ok"]);
    expect((await methods.methods(OWNER_ID)).filter((row) => row.enabled && row.ready)).toHaveLength(1);
}

async function authenticatorSavedAndRemoved({ methods }: Stores): Promise<void> {
    await methods.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed-1", ready: false }, NOW);
    expect(await methods.authenticator(OWNER_ID)).toEqual({ sealedSecret: "sealed-1", enabled: true, ready: false });
    await methods.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed-1", ready: true }, NOW);
    expect((await methods.methods(OWNER_ID))[3]).toEqual({ kind: "authenticator", enabled: true, ready: true });
    expect(await methods.removeAuthenticator(OWNER_ID, { mailOn: true }, NOW)).toBe("ok");
    expect(await methods.authenticator(OWNER_ID)).toEqual({ sealedSecret: null, enabled: false, ready: false });
    await methods.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed-2", ready: true }, NOW);
    await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: true }, NOW);
    expect(await methods.removeAuthenticator(OWNER_ID, { mailOn: true }, NOW)).toBe("last_way");
}

async function stepsAcceptedInOrder({ methods }: Stores): Promise<void> {
    await methods.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed", ready: true }, NOW);
    expect(await methods.acceptStep(OWNER_ID, 100)).toBe(true);
    expect([await methods.acceptStep(OWNER_ID, 100), await methods.acceptStep(OWNER_ID, 99)]).toEqual([false, false]);
    const both = await Promise.all([methods.acceptStep(OWNER_ID, 101), methods.acceptStep(OWNER_ID, 101)]);
    expect(both.sort()).toEqual([false, true]);
}

export function methodContract(makeStores: MakeStores): void {
    test("an authenticator is saved sealed, made ready, and removed, but never when it is the last usable way", withOwner(makeStores, authenticatorSavedAndRemoved));
    methodStrictCases(makeStores);
    test("setting a password enables and readies password sign-in with the new digest", withOwner(makeStores, passwordSet));
    test("an account lists all four ways, absent ones off and not set up, and ticking one not set up leaves it unusable", withOwner(makeStores, fourWaysListed));
}

export function methodStrictCases(makeStores: MakeStores): void {
    test("an authenticator step is accepted only when later than the last one, once, even when two arrive at once", withOwner(makeStores, stepsAcceptedInOrder));
    test("a change that would leave no usable way is refused, email links counting only with mail on, even when two run at once", withOwner(makeStores, lastWayKept));
}
