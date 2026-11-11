import { expect, test } from "vitest";
import { makeJob } from "../../src/jobs/job.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

export interface RemovalHooks {
    userRows(userId: number): Promise<Record<string, number>>;
    sharedCounts(): Promise<Record<string, number>>;
    codes(): Promise<Array<{ createdBy: number | null; usedBy: number | null }>>;
}

type Hooks = (stores: TestStores) => RemovalHooks;
type Contract = { stores: TestStores; hooks: RemovalHooks };

const NOW = "2026-11-09T10:00:00.000Z";
const PAST = "2026-11-01T10:00:00.000Z";
const LATER = "2026-12-09T10:00:00.000Z";

function withContract(make: MakeStores, hooks: Hooks, check: (contract: Contract) => Promise<void>) {
    return async () => {
        const stores = await make();
        try {
            await check({ stores, hooks: hooks(stores) });
        } finally {
            await stores.close();
        }
    };
}

async function secondAccount(stores: TestStores, email = "ada@example.com", code = `code-${email}`): Promise<number> {
    await stores.accountCodes.makeCode(code, OWNER_ID, NOW);
    const created = await stores.accounts.createAccount({ email, emailKey: email, name: "Ada", passwordDigest: "d" }, code, NOW);
    if (created.kind !== "created") throw new Error(`no account: ${created.kind}`);
    return created.userId;
}

async function ownerAndSecond(stores: TestStores): Promise<number> {
    await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
    return secondAccount(stores);
}

async function seedSignIn(stores: TestStores, userId: number): Promise<void> {
    await stores.keys.addKey(userId, { name: "key", credentialId: `cred-${userId}`, publicKey: "pk", counter: 0, transports: [] }, NOW);
    await stores.keys.makeChallenge(`ch-${userId}`, { purpose: "signin", userId }, NOW);
    await stores.recoveryCodes.replace(userId, [`rc-${userId}`], NOW);
    await stores.sessions.create({ idDigest: `sess-${userId}`, userId, csrfDigest: "c", createdAt: NOW, lastUsedAt: NOW, verifiedAt: NOW, address: "direct", device: { ip: null, os: null, location: null } });
    await stores.emailLinks.make(userId, { purpose: "signin", digest: `tok-${userId}` }, NOW);
    await stores.events.record({ userId, at: NOW, address: "direct", event: "signed_in", method: "password" });
}

async function seedData(stores: TestStores, userId: number): Promise<void> {
    const mine = stores.forUser(userId);
    await mine.sources.save({ module: "greenhouse", name: "Acme", params: { slug: "acme" }, target: "greenhouse:acme", enabled: true }, NOW);
    await mine.searchSettings.save({ preferences: "remote" }, NOW);
    const resume = await mine.resume.saveResume({ text: "# Ada", fileName: "resume.md", fileType: "md", uploadedAt: NOW });
    await mine.resume.saveProfile({ summary: "s", skills: [], resumeId: resume.contentId, extractedAt: NOW, editedAt: null });
    await mine.gmail.connected({ email: "ada@gmail.com", sealedPassword: "sealed" }, NOW);
    await mine.alerts.recordRead({ uidValidity: 1, lastUid: 2, emails: 1, jobs: 1, notUnderstood: 0 }, NOW);
    await mine.jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "shared-1", company: "Acme", title: "Engineer", url: "https://example.com/1" }, {})], NOW, "Acme");
    await mine.jobStore.recordVerdict({ job_id: "shared-1", score: 70, reasons: [], gaps: [] }, { scoredAt: NOW, runId: "run-1" });
    await mine.rescoreLog.begin({ ats: "greenhouse", jobId: "shared-1" }, `rescore-${userId}`, NOW);
    await stores.runHistory.begin(`run-${userId}`, NOW);
    await stores.runHistory.partStarted({ runId: `run-${userId}`, userId, partId: null, at: NOW });
}

async function seedAccount(stores: TestStores, userId: number): Promise<void> {
    await seedSignIn(stores, userId);
    await seedData(stores, userId);
    await stores.accounts.setStatus(userId, { deactivatedAt: PAST, deleteAfter: PAST });
}

function total(rows: Record<string, number>): number {
    return Object.values(rows).reduce((sum, count) => sum + count, 0);
}

async function removesEverythingOfTheirs({ stores, hooks }: Contract): Promise<void> {
    const adaId = await ownerAndSecond(stores);
    await seedData(stores, OWNER_ID);
    await seedAccount(stores, adaId);
    const [ownerBefore, sharedBefore] = [await hooks.userRows(OWNER_ID), await hooks.sharedCounts()];
    expect(Object.entries(await hooks.userRows(adaId)).filter(([, count]) => count === 0)).toEqual([]);
    expect(await stores.removal.remove(adaId, NOW)).toBe("deleted");
    expect(total(await hooks.userRows(adaId))).toBe(0);
    expect([await hooks.userRows(OWNER_ID), await hooks.sharedCounts()]).toEqual([ownerBefore, sharedBefore]);
    expect(await stores.accounts.account(adaId)).toBeNull();
    expect(await hooks.codes()).toEqual([{ createdBy: OWNER_ID, usedBy: null }]);
}

async function sameEmailStartsEmpty({ stores }: Contract): Promise<void> {
    const adaId = await ownerAndSecond(stores);
    await seedAccount(stores, adaId);
    await stores.removal.remove(adaId, NOW);
    const again = stores.forUser(await secondAccount(stores, "ada@example.com", "second-code"));
    expect([await again.jobViews.countAllJobs(), (await again.sources.list()).length, await again.resume.currentResume(), (await again.gmail.connection())?.email ?? null]).toEqual([0, 0, null, null]);
}

async function onlyAdminHeld({ stores }: Contract): Promise<void> {
    await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
    await stores.accounts.setStatus(OWNER_ID, { deactivatedAt: PAST, deleteAfter: PAST });
    expect(await stores.removal.remove(OWNER_ID, NOW)).toBe("last_admin");
    expect(await stores.accounts.account(OWNER_ID)).toMatchObject({ deleteAfter: PAST });
}

async function unknownAndNotDue({ stores }: Contract): Promise<void> {
    const adaId = await ownerAndSecond(stores);
    expect(await stores.removal.remove(999, NOW)).toBe("gone");
    await stores.accounts.setStatus(adaId, { deactivatedAt: PAST, deleteAfter: LATER });
    expect(await stores.removal.remove(adaId, NOW)).toBe("not_due");
    await stores.accounts.setStatus(adaId, { deleteAfter: null });
    expect(await stores.removal.remove(adaId, NOW)).toBe("not_due");
    expect(await stores.accounts.account(adaId)).not.toBeNull();
}

async function dueOldestFirst({ stores }: Contract): Promise<void> {
    const adaId = await ownerAndSecond(stores);
    const bobId = await secondAccount(stores, "bob@example.com");
    await stores.accounts.setStatus(adaId, { deactivatedAt: PAST, deleteAfter: "2026-11-08T00:00:00.000Z" });
    await stores.accounts.setStatus(bobId, { deactivatedAt: PAST, deleteAfter: PAST });
    await stores.accounts.setStatus(OWNER_ID, { deactivatedAt: PAST, deleteAfter: LATER });
    expect(await stores.removal.due(NOW)).toEqual([bobId, adaId]);
}

async function removedOnceAtATime({ stores }: Contract): Promise<void> {
    const adaId = await ownerAndSecond(stores);
    await seedAccount(stores, adaId);
    const outcomes = await Promise.all([stores.removal.remove(adaId, NOW), stores.removal.remove(adaId, NOW)]);
    expect(outcomes.sort()).toEqual(["deleted", "gone"]);
}

export function accountRemovalContract(make: MakeStores, hooks: Hooks, options: { strict: boolean }): void {
    test("removing an account deletes every row of theirs and nothing shared or anyone else's, keeping the creation code with its user cleared", withContract(make, hooks, removesEverythingOfTheirs));
    test("an email freed by a removal makes a new account that starts empty", withContract(make, hooks, sameEmailStartsEmpty));
    test("the only admin's due deletion is held", withContract(make, hooks, onlyAdminHeld));
    test("an unknown account is gone, and one whose deletion isn't due, or was cancelled, is not removed", withContract(make, hooks, unknownAndNotDue));
    test("due deletions are listed oldest first, leaving those not yet due", withContract(make, hooks, dueOldestFirst));
    if (options.strict) test("two removals of one account at once delete it once, without an error", withContract(make, hooks, removedOnceAtATime));
}
