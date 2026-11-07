import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { Stores } from "../../src/db/store.js";
import { withOwner } from "./methodContract.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";

async function authenticatorSavedAndRemoved({ methods, authenticators }: Stores): Promise<void> {
    await authenticators.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed-1", ready: false }, NOW);
    expect(await authenticators.authenticator(OWNER_ID)).toEqual({ sealedSecret: "sealed-1", enabled: true, ready: false });
    await authenticators.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed-1", ready: true }, NOW);
    expect((await methods.methods(OWNER_ID))[3]).toEqual({ kind: "authenticator", enabled: true, ready: true });
    expect(await authenticators.removeAuthenticator(OWNER_ID, { mailOn: true }, NOW)).toBe("ok");
    expect(await authenticators.authenticator(OWNER_ID)).toEqual({ sealedSecret: null, enabled: false, ready: false });
    await authenticators.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed-2", ready: true }, NOW);
    await methods.setEnabled(OWNER_ID, { kind: "password", enabled: false, mailOn: true }, NOW);
    expect(await authenticators.removeAuthenticator(OWNER_ID, { mailOn: true }, NOW)).toBe("last_way");
}

async function stepsAcceptedInOrder({ authenticators }: Stores): Promise<void> {
    await authenticators.saveAuthenticator(OWNER_ID, { sealedSecret: "sealed", ready: true }, NOW);
    expect(await authenticators.acceptStep(OWNER_ID, 100)).toBe(true);
    expect([await authenticators.acceptStep(OWNER_ID, 100), await authenticators.acceptStep(OWNER_ID, 99)]).toEqual([false, false]);
    const both = await Promise.all([authenticators.acceptStep(OWNER_ID, 101), authenticators.acceptStep(OWNER_ID, 101)]);
    expect(both.sort()).toEqual([false, true]);
}

export function authenticatorContract(makeStores: MakeStores): void {
    test("an authenticator is saved sealed, made ready, and removed, but never when it is the last usable way", withOwner(makeStores, authenticatorSavedAndRemoved));
    authenticatorStrictCases(makeStores);
}

export function authenticatorStrictCases(makeStores: MakeStores): void {
    test("an authenticator step is accepted only when later than the last one, once, even when two arrive at once", withOwner(makeStores, stepsAcceptedInOrder));
}
