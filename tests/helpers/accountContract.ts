import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";
const LOGIN = { email: "Owner@Example.com", emailKey: "owner@example.com", passwordDigest: "argon2id$x" };

function withStores(makeStores: MakeStores, check: (stores: TestStores) => Promise<void>) {
    return async () => {
        const stores = await makeStores();
        try {
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}

async function ownerInitOnce({ accounts, methods }: TestStores): Promise<void> {
    expect(await accounts.initOwner(LOGIN, NOW)).toBe(true);
    expect(await accounts.initOwner({ ...LOGIN, email: "other@example.com", emailKey: "other@example.com" }, NOW)).toBe(false);
    expect(await accounts.account(OWNER_ID)).toEqual({ id: OWNER_ID, name: "owner", email: "Owner@Example.com", isAdmin: true, deactivatedAt: null, deleteAfter: null });
    expect(await methods.passwordDigest(OWNER_ID)).toBe("argon2id$x");
    expect(await accounts.userIds()).toEqual([OWNER_ID]);
}

async function foundByKey({ accounts }: TestStores): Promise<void> {
    await accounts.initOwner(LOGIN, NOW);
    expect((await accounts.byEmailKey("owner@example.com"))?.id).toBe(OWNER_ID);
    expect(await accounts.byEmailKey("Owner@Example.com")).toBeNull();
    expect((await accounts.account(OWNER_ID))?.isAdmin).toBe(true);
    expect(await accounts.account(99)).toBeNull();
}

const LATER = "2026-11-06T11:00:00.000Z";
const ADA = { email: "Ada@Example.com", emailKey: "ada@example.com", name: "Ada Lovelace", passwordDigest: "argon2id$ada" };

async function codedOwner(stores: TestStores, ...codes: string[]): Promise<void> {
    await stores.accounts.initOwner(LOGIN, NOW);
    for (const code of codes) await stores.accountCodes.makeCode(code, OWNER_ID, NOW);
}

async function createdOnceWithAFreshCode(stores: TestStores): Promise<void> {
    await codedOwner(stores, "code-1", "code-2");
    const created = await stores.accounts.createAccount(ADA, "code-1", LATER);
    if (created.kind !== "created") throw new Error(`not created: ${created.kind}`);
    expect(await stores.accounts.account(created.userId)).toEqual({ id: created.userId, name: "Ada Lovelace", email: "Ada@Example.com", isAdmin: false, deactivatedAt: null, deleteAfter: null });
    expect(await stores.methods.passwordDigest(created.userId)).toBe("argon2id$ada");
    expect(await stores.accounts.createAccount({ ...ADA, email: "b@example.com", emailKey: "b@example.com" }, "code-1", LATER)).toEqual({ kind: "refused" });
    expect(await stores.accounts.createAccount({ ...ADA, email: "c@example.com", emailKey: "c@example.com" }, "never-made", LATER)).toEqual({ kind: "refused" });
    expect(await stores.accounts.createAccount({ ...ADA, email: "ADA@example.com" }, "code-2", LATER)).toEqual({ kind: "taken" });
    expect((await stores.accounts.createAccount({ ...ADA, email: "d@example.com", emailKey: "d@example.com" }, "code-2", LATER)).kind).toBe("created");
}

async function oneCodeOneAccount(stores: TestStores): Promise<void> {
    await codedOwner(stores, "shared");
    const results = await Promise.all(["x", "y"].map((who) => stores.accounts.createAccount({ ...ADA, email: `${who}@example.com`, emailKey: `${who}@example.com` }, "shared", LATER)));
    expect(results.map((result) => result.kind).sort()).toEqual(["created", "refused"]);
    expect((await stores.accounts.accounts()).map((account) => account.email).sort()).toHaveLength(2);
}

async function lastAdminKept(stores: TestStores): Promise<void> {
    await codedOwner(stores, "code-1");
    const created = await stores.accounts.createAccount(ADA, "code-1", LATER);
    if (created.kind !== "created") throw new Error("not created");
    expect(await stores.accounts.accounts()).toEqual([
        { id: OWNER_ID, name: "owner", email: "Owner@Example.com", isAdmin: true, deactivatedAt: null, deleteAfter: null },
        { id: created.userId, name: "Ada Lovelace", email: "Ada@Example.com", isAdmin: false, deactivatedAt: null, deleteAfter: null },
    ]);
    expect(await stores.accounts.setAdmin(OWNER_ID, false)).toBe("last_admin");
    expect(await stores.accounts.setAdmin(created.userId, true)).toBe("ok");
    expect(await stores.accounts.setAdmin(OWNER_ID, false)).toBe("ok");
    expect(await stores.accounts.setAdmin(created.userId, false)).toBe("last_admin");
    expect((await stores.accounts.accounts()).map((account) => account.isAdmin)).toEqual([false, true]);
}

async function renamed(stores: TestStores): Promise<void> {
    await stores.accounts.initOwner(LOGIN, NOW);
    await stores.accounts.saveName(OWNER_ID, "Zac");
    expect((await stores.accounts.account(OWNER_ID))?.name).toBe("Zac");
}

async function eventsListed(stores: TestStores): Promise<void> {
    await stores.accounts.initOwner(LOGIN, NOW);
    for (let minute = 0; minute < 22; minute += 1) await stores.events.record({ userId: OWNER_ID, at: `2026-11-06T10:${String(minute).padStart(2, "0")}:00.000Z`, address: minute === 0 ? null : "direct", event: "signed_in", method: "password" });
    const recent = await stores.events.recent(OWNER_ID, 20);
    expect(recent).toHaveLength(20);
    expect([recent[0]?.at, recent[19]?.at]).toEqual(["2026-11-06T10:21:00.000Z", "2026-11-06T10:02:00.000Z"]);
    expect(recent[0]).toEqual({ userId: OWNER_ID, at: "2026-11-06T10:21:00.000Z", address: "direct", event: "signed_in", method: "password" });
}

async function emailChangedUnlessTaken({ accounts, accountCodes }: TestStores): Promise<void> {
    await accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
    await accountCodes.makeCode("c", OWNER_ID, NOW);
    await accounts.createAccount({ email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" }, "c", NOW);
    expect(await accounts.changeEmail(OWNER_ID, "Zac@Example.com", "zac@example.com")).toBe("ok");
    expect((await accounts.account(OWNER_ID))?.email).toBe("Zac@Example.com");
    expect((await accounts.byEmailKey("zac@example.com"))?.id).toBe(OWNER_ID);
    expect(await accounts.changeEmail(OWNER_ID, "ADA@example.com", "ada@example.com")).toBe("taken");
}

async function statusStored({ accounts, accountCodes }: TestStores): Promise<void> {
    await accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
    await accountCodes.makeCode("c", OWNER_ID, NOW);
    const created = await accounts.createAccount({ email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" }, "c", NOW);
    const adaId = created.kind === "created" ? created.userId : 0;
    await accounts.setStatus(adaId, { deactivatedAt: NOW, deleteAfter: "2026-12-06T10:00:00.000Z" });
    expect(await accounts.account(adaId)).toMatchObject({ deactivatedAt: NOW, deleteAfter: "2026-12-06T10:00:00.000Z" });
    expect(await accounts.account(OWNER_ID)).toMatchObject({ deactivatedAt: null, deleteAfter: null });
    await accounts.setStatus(adaId, { deleteAfter: null });
    expect(await accounts.account(adaId)).toMatchObject({ deactivatedAt: NOW, deleteAfter: null });
    await accounts.setStatus(adaId, { deleteAfter: "2026-12-06T10:00:00.000Z" });
    expect(await accounts.reactivate(adaId)).toBe("deletion_pending");
    expect(await accounts.account(adaId)).toMatchObject({ deactivatedAt: NOW, deleteAfter: "2026-12-06T10:00:00.000Z" });
    await accounts.setStatus(adaId, { deleteAfter: null });
    expect(await accounts.reactivate(adaId)).toBe("ok");
    expect(await accounts.account(adaId)).toMatchObject({ deactivatedAt: null, deleteAfter: null });
}

export function accountContract(makeStores: MakeStores): void {
    test("an account's name can be changed", withStores(makeStores, renamed));
    test("an account's last 20 security events read back newest first, with their address or none", withStores(makeStores, eventsListed));
    accountStrictCases(makeStores);
    test("an account is found by its normalised email key alone, and only its own admin mark counts", withStores(makeStores, foundByKey));
    test("an account is made with an unspent code and a free email, spending the code; a spent or unknown code is refused and a taken email leaves the code unspent", withStores(makeStores, createdOnceWithAFreshCode));
    test("accounts are listed with their admin marks, and the last admin's mark can't be removed, by anyone", withStores(makeStores, lastAdminKept));
    test("an email changes to a free address and is refused when another account holds it", withStores(makeStores, emailChangedUnlessTaken));
}

export function accountStrictCases(makeStores: MakeStores): void {
    test("the owner gets an email, the admin mark and a usable password once, and never again, and is the one user listed", withStores(makeStores, ownerInitOnce));
    test("two accounts made at once with one code: one is made and the other refused", withStores(makeStores, oneCodeOneAccount));
    test("an account's deactivation and deletion dates are stored and read back, each written only when given, touching no other account; reactivating clears the deactivation only while no deletion is pending", withStores(makeStores, statusStored));
}
