import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { Stores } from "../../src/db/store.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";
const LOGIN = { email: "Owner@Example.com", emailKey: "owner@example.com", passwordDigest: "argon2id$x" };

function withStores(makeStores: MakeStores, check: (stores: Stores) => Promise<void>) {
    return async () => {
        const stores = await makeStores();
        try {
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}

async function ownerInitOnce({ accounts, methods }: Stores): Promise<void> {
    expect(await accounts.initOwner(LOGIN, NOW)).toBe(true);
    expect(await accounts.initOwner({ ...LOGIN, email: "other@example.com", emailKey: "other@example.com" }, NOW)).toBe(false);
    expect(await accounts.account(OWNER_ID)).toEqual({ id: OWNER_ID, name: "owner", email: "Owner@Example.com", isAdmin: true });
    expect(await methods.passwordDigest(OWNER_ID)).toBe("argon2id$x");
}

async function foundByKey({ accounts }: Stores): Promise<void> {
    await accounts.initOwner(LOGIN, NOW);
    expect((await accounts.byEmailKey("owner@example.com"))?.id).toBe(OWNER_ID);
    expect(await accounts.byEmailKey("Owner@Example.com")).toBeNull();
    expect(await accounts.isAdmin(OWNER_ID)).toBe(true);
    expect([await accounts.account(99), await accounts.isAdmin(99)]).toEqual([null, false]);
}

export function accountContract(makeStores: MakeStores): void {
    accountStrictCases(makeStores);
    test("an account is found by its normalised email key alone, and only its own admin mark counts", withStores(makeStores, foundByKey));
}

export function accountStrictCases(makeStores: MakeStores): void {
    test("the owner gets an email, the admin mark and a usable password once, and never again", withStores(makeStores, ownerInitOnce));
}
