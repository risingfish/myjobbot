import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";
const ADA = { email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" };

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

async function codeExpires({ accounts, tokens }: TestStores): Promise<void> {
    await tokens.makeCode("early", OWNER_ID, NOW);
    await tokens.makeCode("late", OWNER_ID, NOW);
    expect((await accounts.createAccount(ADA, "early", "2026-11-13T09:59:59.000Z")).kind).toBe("created");
    expect(await accounts.createAccount({ ...ADA, email: "b@example.com", emailKey: "b@example.com" }, "late", "2026-11-13T10:00:01.000Z")).toEqual({ kind: "refused" });
}

async function linksLastByPurpose({ tokens }: TestStores): Promise<void> {
    await tokens.makeEmailToken(OWNER_ID, { purpose: "signin", digest: "s" }, NOW);
    await tokens.makeEmailToken(OWNER_ID, { purpose: "reset", digest: "r" }, NOW);
    await tokens.makeEmailToken(OWNER_ID, { purpose: "email_change", digest: "e", newEmail: "new@example.com" }, NOW);
    expect(await tokens.spendEmailToken({ digest: "s", purpose: "signin" }, minutesLater(16))).toBeNull();
    expect(await tokens.spendEmailToken({ digest: "r", purpose: "reset" }, minutesLater(29))).toEqual({ userId: OWNER_ID, newEmail: null, returnPath: null });
    expect(await tokens.spendEmailToken({ digest: "r", purpose: "reset" }, minutesLater(29))).toBeNull();
    expect(await tokens.spendEmailToken({ digest: "e", purpose: "signin" }, minutesLater(1))).toBeNull();
    expect(await tokens.spendEmailToken({ digest: "e", purpose: "email_change" }, minutesLater(23 * 60))).toEqual({ userId: OWNER_ID, newEmail: "new@example.com", returnPath: null });
}

async function newLinkEndsOld({ tokens }: TestStores): Promise<void> {
    await tokens.makeEmailToken(OWNER_ID, { purpose: "signin", digest: "first" }, NOW);
    await tokens.makeEmailToken(OWNER_ID, { purpose: "reset", digest: "other-purpose" }, NOW);
    await tokens.makeEmailToken(OWNER_ID, { purpose: "signin", digest: "second" }, minutesLater(1));
    expect(await tokens.spendEmailToken({ digest: "first", purpose: "signin" }, minutesLater(2))).toBeNull();
    expect(await tokens.spendEmailToken({ digest: "second", purpose: "signin" }, minutesLater(2))).not.toBeNull();
    expect(await tokens.spendEmailToken({ digest: "other-purpose", purpose: "reset" }, minutesLater(2))).not.toBeNull();
}

async function stepUpBoundToItsSession({ tokens }: TestStores): Promise<void> {
    await tokens.makeEmailToken(OWNER_ID, { purpose: "step_up", digest: "u", sessionDigest: "mine", returnPath: "/account" }, NOW);
    expect(await tokens.spendEmailToken({ digest: "u", purpose: "step_up", sessionDigest: "theirs" }, minutesLater(1))).toBeNull();
    expect(await tokens.emailTokenFor("u", minutesLater(1))).toEqual({ purpose: "step_up", sessionDigest: "mine", live: true });
    expect(await tokens.spendEmailToken({ digest: "u", purpose: "step_up", sessionDigest: "mine" }, minutesLater(1))).toEqual({ userId: OWNER_ID, newEmail: null, returnPath: "/account" });
    expect(await tokens.emailTokenFor("u", minutesLater(1))).toEqual({ purpose: "step_up", sessionDigest: "mine", live: false });
    expect(await tokens.emailTokenFor("never", NOW)).toBeNull();
}

async function oneSpendWins({ tokens }: TestStores): Promise<void> {
    await tokens.makeEmailToken(OWNER_ID, { purpose: "signin", digest: "race" }, NOW);
    const spent = await Promise.all([1, 2].map(() => tokens.spendEmailToken({ digest: "race", purpose: "signin" }, minutesLater(1))));
    expect(spent.filter((row) => row !== null)).toHaveLength(1);
}

async function emailChangedUnlessTaken({ accounts, tokens }: TestStores): Promise<void> {
    await tokens.makeCode("c", OWNER_ID, NOW);
    await accounts.createAccount(ADA, "c", NOW);
    expect(await accounts.changeEmail(OWNER_ID, "Zac@Example.com", "zac@example.com")).toBe("ok");
    expect((await accounts.account(OWNER_ID))?.email).toBe("Zac@Example.com");
    expect((await accounts.byEmailKey("zac@example.com"))?.id).toBe(OWNER_ID);
    expect(await accounts.changeEmail(OWNER_ID, "ADA@example.com", "ada@example.com")).toBe("taken");
}

async function recoveryCodesReplacedAndSpent({ tokens }: TestStores): Promise<void> {
    await tokens.replaceRecoveryCodes(OWNER_ID, ["a", "b", "c"], NOW);
    expect(await tokens.recoveryCodesLeft(OWNER_ID)).toBe(3);
    expect([await tokens.spendRecoveryCode(OWNER_ID, "a", NOW), await tokens.spendRecoveryCode(OWNER_ID, "a", NOW), await tokens.spendRecoveryCode(99, "b", NOW)]).toEqual([true, false, false]);
    expect(await tokens.recoveryCodesLeft(OWNER_ID)).toBe(2);
    await tokens.replaceRecoveryCodes(OWNER_ID, ["d", "e"], NOW);
    expect([await tokens.spendRecoveryCode(OWNER_ID, "b", NOW), await tokens.recoveryCodesLeft(OWNER_ID)]).toEqual([false, 2]);
}

export function tokenContract(makeStores: MakeStores): void {
    test("a new set of recovery codes replaces the old, each code works once for its own account, and the unused are counted", withOwner(makeStores, recoveryCodesReplacedAndSpent));
    tokenStrictCases(makeStores);
    test("an account creation code works until 7 days after it was made, and not after", withOwner(makeStores, codeExpires));
    test("an emailed link works once, for its own purpose only, within 15 minutes, 30 minutes or 24 hours by purpose", withOwner(makeStores, linksLastByPurpose));
    test("a new link of a purpose ends the account's unused ones of that purpose only", withOwner(makeStores, newLinkEndsOld));
    test("a confirm-it's-you link works only from the sign-in that asked for it, and can be looked up without spending it", withOwner(makeStores, stepUpBoundToItsSession));
    test("an email changes to a free address and is refused when another account holds it", withOwner(makeStores, emailChangedUnlessTaken));
}

export function tokenStrictCases(makeStores: MakeStores): void {
    test("two spends of one link at once: only one works", withOwner(makeStores, oneSpendWins));
}
