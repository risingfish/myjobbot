import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { MakeStores } from "./storeContract.js";
import { NOW, withInitialOwner } from "./initialOwner.js";

function minutesLater(minutes: number): string {
    return new Date(Date.parse(NOW) + minutes * 60 * 1000).toISOString();
}

async function linksLastByPurpose({ emailLinks }: TestStores): Promise<void> {
    await emailLinks.make(OWNER_ID, { purpose: "signin", digest: "s" }, NOW);
    await emailLinks.make(OWNER_ID, { purpose: "reset", digest: "r" }, NOW);
    await emailLinks.make(OWNER_ID, { purpose: "email_change", digest: "e", newEmail: "new@example.com" }, NOW);
    expect(await emailLinks.spend({ digest: "s", purpose: "signin" }, minutesLater(16))).toBeNull();
    expect(await emailLinks.spend({ digest: "r", purpose: "reset" }, minutesLater(29))).toEqual({ userId: OWNER_ID, newEmail: null, returnPath: null });
    expect(await emailLinks.spend({ digest: "r", purpose: "reset" }, minutesLater(29))).toBeNull();
    expect(await emailLinks.spend({ digest: "e", purpose: "signin" }, minutesLater(1))).toBeNull();
    expect(await emailLinks.spend({ digest: "e", purpose: "email_change" }, minutesLater(23 * 60))).toEqual({ userId: OWNER_ID, newEmail: "new@example.com", returnPath: null });
}

async function newLinkEndsOld({ emailLinks }: TestStores): Promise<void> {
    await emailLinks.make(OWNER_ID, { purpose: "signin", digest: "first" }, NOW);
    await emailLinks.make(OWNER_ID, { purpose: "reset", digest: "other-purpose" }, NOW);
    await emailLinks.make(OWNER_ID, { purpose: "signin", digest: "second" }, minutesLater(1));
    expect(await emailLinks.spend({ digest: "first", purpose: "signin" }, minutesLater(2))).toBeNull();
    expect(await emailLinks.spend({ digest: "second", purpose: "signin" }, minutesLater(2))).not.toBeNull();
    expect(await emailLinks.spend({ digest: "other-purpose", purpose: "reset" }, minutesLater(2))).not.toBeNull();
}

async function stepUpBoundToItsSession({ emailLinks }: TestStores): Promise<void> {
    await emailLinks.make(OWNER_ID, { purpose: "step_up", digest: "u", sessionDigest: "mine", returnPath: "/account" }, NOW);
    expect(await emailLinks.spend({ digest: "u", purpose: "step_up", sessionDigest: "theirs" }, minutesLater(1))).toBeNull();
    expect(await emailLinks.lookup("u", minutesLater(1))).toEqual({ purpose: "step_up", sessionDigest: "mine", live: true });
    expect(await emailLinks.spend({ digest: "u", purpose: "step_up", sessionDigest: "mine" }, minutesLater(1))).toEqual({ userId: OWNER_ID, newEmail: null, returnPath: "/account" });
    expect(await emailLinks.lookup("u", minutesLater(1))).toEqual({ purpose: "step_up", sessionDigest: "mine", live: false });
    expect(await emailLinks.lookup("never", NOW)).toBeNull();
}

async function oneSpendWins({ emailLinks }: TestStores): Promise<void> {
    await emailLinks.make(OWNER_ID, { purpose: "signin", digest: "race" }, NOW);
    const spent = await Promise.all([1, 2].map(() => emailLinks.spend({ digest: "race", purpose: "signin" }, minutesLater(1))));
    expect(spent.filter((row) => row !== null)).toHaveLength(1);
}

export function emailLinkContract(makeStores: MakeStores): void {
    emailLinkStrictCases(makeStores);
    test("an emailed link works once, for its own purpose only, within 15 minutes, 30 minutes or 24 hours by purpose", withInitialOwner(makeStores, linksLastByPurpose));
    test("a new link of a purpose ends the account's unused ones of that purpose only", withInitialOwner(makeStores, newLinkEndsOld));
    test("a confirm-it's-you link works only from the sign-in that asked for it, and can be looked up without spending it", withInitialOwner(makeStores, stepUpBoundToItsSession));
}

export function emailLinkStrictCases(makeStores: MakeStores): void {
    test("two spends of one link at once: only one works", withInitialOwner(makeStores, oneSpendWins));
}
