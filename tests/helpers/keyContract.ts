import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-07T10:00:00.000Z";
const BLUE = { name: "Blue key", credentialId: "cred-blue", publicKey: "pk-blue", counter: 0, transports: ["usb"] };

function withOwner(makeStores: MakeStores, check: (stores: TestStores) => Promise<void>) {
    return async () => {
        const stores = await makeStores();
        try {
            await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}

function minutesLater(minutes: number): string {
    return new Date(Date.parse(NOW) + minutes * 60 * 1000).toISOString();
}

async function namesAndCredentialsUnique({ keys }: TestStores): Promise<void> {
    expect(await keys.addKey(OWNER_ID, BLUE, NOW)).toBe("ok");
    expect(await keys.addKey(OWNER_ID, { ...BLUE, credentialId: "cred-other" }, NOW)).toBe("name_taken");
    expect(await keys.addKey(OWNER_ID, { ...BLUE, name: "Red key" }, NOW)).toBe("credential_taken");
    await keys.makeChallenge("ch", { purpose: "signin", userId: null }, NOW);
    const spent = await Promise.all([keys.spendChallenge("ch", "signin", minutesLater(1)), keys.spendChallenge("ch", "signin", minutesLater(1))]);
    expect(spent.filter((row) => row !== null)).toHaveLength(1);
}

async function keysListedAndCounted({ keys, methods }: TestStores): Promise<void> {
    await keys.addKey(OWNER_ID, BLUE, NOW);
    expect(await keys.keys(OWNER_ID)).toEqual([{ id: expect.any(Number), name: "Blue key" }]);
    expect((await methods.methods(OWNER_ID))[2]).toEqual({ kind: "hardware_key", enabled: true, ready: true });
    const stored = await keys.keyByCredential("cred-blue");
    expect(stored).toMatchObject({ userId: OWNER_ID, name: "Blue key", publicKey: "pk-blue", counter: 0, transports: ["usb"] });
    await keys.updateCounter(stored?.id ?? 0, 7, NOW);
    expect((await keys.keyByCredential("cred-blue"))?.counter).toBe(7);
    expect(await keys.keyByCredential("nope")).toBeNull();
}

async function lastKeyRemoved({ keys, methods }: TestStores): Promise<void> {
    await keys.addKey(OWNER_ID, BLUE, NOW);
    const [blue] = await keys.keys(OWNER_ID);
    await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: true }, NOW);
    expect(await keys.removeKey(OWNER_ID, { id: blue?.id ?? 0, mailOn: true }, NOW)).toBe("last_way");
    await methods.setEnabled(OWNER_ID, { kind: "password", enabled: true, mailOn: true }, NOW);
    await methods.setEnabled(OWNER_ID, { kind: "hardware_key", enabled: false, mailOn: true }, NOW);
    expect(await keys.removeKey(OWNER_ID, { id: blue?.id ?? 0, mailOn: true }, NOW)).toBe("ok");
    const key = (await methods.methods(OWNER_ID))[2];
    expect([await keys.keys(OWNER_ID), key?.ready, key?.enabled]).toEqual([[], false, false]);
}

async function challengesOnceWithinFiveMinutes({ keys }: TestStores): Promise<void> {
    await keys.makeChallenge("a", { purpose: "register", userId: OWNER_ID }, NOW);
    await keys.makeChallenge("b", { purpose: "signin", userId: null }, NOW);
    expect(await keys.spendChallenge("a", "signin", minutesLater(1))).toBeNull();
    expect(await keys.spendChallenge("a", "register", minutesLater(4))).toEqual({ userId: OWNER_ID });
    expect(await keys.spendChallenge("a", "register", minutesLater(4))).toBeNull();
    expect(await keys.spendChallenge("b", "signin", minutesLater(6))).toBeNull();
}

export function keyContract(makeStores: MakeStores): void {
    keyStrictCases(makeStores);
    test("a key is listed by name, found by its credential, and its counter kept", withOwner(makeStores, keysListedAndCounted));
    test("removing the last key turns the way's setup off, but never when it is the last usable way", withOwner(makeStores, lastKeyRemoved));
    test("a challenge works once, for its own purpose, within 5 minutes", withOwner(makeStores, challengesOnceWithinFiveMinutes));
}

export function keyStrictCases(makeStores: MakeStores): void {
    test("an account's key names and every credential are unique, and one challenge spent twice at once works once", withOwner(makeStores, namesAndCredentialsUnique));
}
