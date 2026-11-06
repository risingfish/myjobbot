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

const LATER = "2026-11-06T11:00:00.000Z";
const ADA = { email: "Ada@Example.com", emailKey: "ada@example.com", name: "Ada Lovelace", passwordDigest: "argon2id$ada" };

async function codedOwner(stores: Stores, ...codes: string[]): Promise<void> {
    await stores.accounts.initOwner(LOGIN, NOW);
    for (const code of codes) await stores.tokens.makeCode(code, OWNER_ID, NOW);
}

async function createdOnceWithAFreshCode(stores: Stores): Promise<void> {
    await codedOwner(stores, "code-1", "code-2");
    const created = await stores.accounts.createAccount(ADA, "code-1", LATER);
    if (created.kind !== "created") throw new Error(`not created: ${created.kind}`);
    expect(await stores.accounts.account(created.userId)).toEqual({ id: created.userId, name: "Ada Lovelace", email: "Ada@Example.com", isAdmin: false });
    expect(await stores.methods.passwordDigest(created.userId)).toBe("argon2id$ada");
    expect(await stores.accounts.createAccount({ ...ADA, email: "b@example.com", emailKey: "b@example.com" }, "code-1", LATER)).toEqual({ kind: "refused" });
    expect(await stores.accounts.createAccount({ ...ADA, email: "c@example.com", emailKey: "c@example.com" }, "never-made", LATER)).toEqual({ kind: "refused" });
    expect(await stores.accounts.createAccount({ ...ADA, email: "ADA@example.com" }, "code-2", LATER)).toEqual({ kind: "taken" });
    expect((await stores.accounts.createAccount({ ...ADA, email: "d@example.com", emailKey: "d@example.com" }, "code-2", LATER)).kind).toBe("created");
}

async function oneCodeOneAccount(stores: Stores): Promise<void> {
    await codedOwner(stores, "shared");
    const results = await Promise.all(["x", "y"].map((who) => stores.accounts.createAccount({ ...ADA, email: `${who}@example.com`, emailKey: `${who}@example.com` }, "shared", LATER)));
    expect(results.map((result) => result.kind).sort()).toEqual(["created", "refused"]);
    expect((await stores.accounts.accounts()).map((account) => account.email).sort()).toHaveLength(2);
}

async function lastAdminKept(stores: Stores): Promise<void> {
    await codedOwner(stores, "code-1");
    const created = await stores.accounts.createAccount(ADA, "code-1", LATER);
    if (created.kind !== "created") throw new Error("not created");
    expect(await stores.accounts.accounts()).toEqual([
        { id: OWNER_ID, name: "owner", email: "Owner@Example.com", isAdmin: true },
        { id: created.userId, name: "Ada Lovelace", email: "Ada@Example.com", isAdmin: false },
    ]);
    expect(await stores.accounts.setAdmin(OWNER_ID, false)).toBe("last_admin");
    expect(await stores.accounts.setAdmin(created.userId, true)).toBe("ok");
    expect(await stores.accounts.setAdmin(OWNER_ID, false)).toBe("ok");
    expect(await stores.accounts.setAdmin(created.userId, false)).toBe("last_admin");
    expect((await stores.accounts.accounts()).map((account) => account.isAdmin)).toEqual([false, true]);
}

export function accountContract(makeStores: MakeStores): void {
    accountStrictCases(makeStores);
    test("an account is found by its normalised email key alone, and only its own admin mark counts", withStores(makeStores, foundByKey));
    test("an account is made with an unspent code and a free email, spending the code; a spent or unknown code is refused and a taken email leaves the code unspent", withStores(makeStores, createdOnceWithAFreshCode));
    test("accounts are listed with their admin marks, and the last admin's mark can't be removed, by anyone", withStores(makeStores, lastAdminKept));
}

export function accountStrictCases(makeStores: MakeStores): void {
    test("the owner gets an email, the admin mark and a usable password once, and never again", withStores(makeStores, ownerInitOnce));
    test("two accounts made at once with one code: one is made and the other refused", withStores(makeStores, oneCodeOneAccount));
}
