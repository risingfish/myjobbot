import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import type { NewSource, SavedSource, SourceOutcome, UserSourceStore } from "../../src/db/sourceStore.js";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

export interface SourceHooks {
    seedCompany(): Promise<number>;
    jobLinks(): Promise<Array<{ job_id: string; source: string; source_id: number | null }>>;
}

const AT = "2026-10-28T00:00:00.000Z";
const BOARD: NewSource = { module: "greenhouse", name: "Stripe", params: { slug: "stripe" }, target: "greenhouse:stripe", enabled: true };
const SEARCH: NewSource = { module: "jsearch", name: "Zürich remote 🚀", params: { query: "backend engineer", country: "ch", remote_only: true }, target: "jsearch:backend engineer|ch|true", enabled: true };
const FETCHED: SourceOutcome = { at: AT, outcome: "partial", jobs: 100, cost: 2, reason: null };
const FAILED: SourceOutcome = { at: AT, outcome: "failing", jobs: 0, cost: 0, reason: "not found" };

async function savesAndEdits(store: UserSourceStore): Promise<SavedSource> {
    expect(await store.list()).toEqual([]);
    const board = await store.save(BOARD, AT);
    expect(board).toEqual({ ...BOARD, id: expect.any(Number), companyId: null, cursor: null, last: null });
    await store.recordFetch(board.id, FETCHED, { offset: 20 });
    const edited = await store.save({ ...board, params: { slug: "stripe-inc" }, target: "greenhouse:stripe-inc" }, AT);
    expect(edited).toEqual({ ...BOARD, id: board.id, params: { slug: "stripe-inc" }, target: "greenhouse:stripe-inc", companyId: null, cursor: null, last: null });
    await store.recordFetch(edited.id, FETCHED, { offset: 20 });
    expect(await store.save(edited, AT)).toEqual({ ...edited, cursor: null, last: FETCHED });
    return edited;
}

async function refusesRepeats(store: UserSourceStore, board: SavedSource): Promise<void> {
    await expect(store.save({ ...SEARCH, target: board.target }, AT)).rejects.toThrow();
    await expect(store.save({ ...SEARCH, name: board.name }, AT)).rejects.toThrow();
    expect((await store.list()).map((source) => source.id)).toEqual([board.id]);
}

async function switchesOffAndOn(store: UserSourceStore, board: SavedSource): Promise<void> {
    await store.recordFetch(board.id, FETCHED, { offset: 40 });
    await store.setEnabled(board.id, false, AT);
    expect((await store.list())[0]).toMatchObject({ enabled: false, cursor: null });
    await store.recordFetch(board.id, FETCHED, { offset: 40 });
    await store.setEnabled(board.id, true, AT);
    expect((await store.list())[0]).toMatchObject({ enabled: true, cursor: null });
}

async function keepsFetchesExactly(store: UserSourceStore, hooks: SourceHooks, board: SavedSource): Promise<SavedSource> {
    const search = await store.save(SEARCH, AT);
    const companyId = await hooks.seedCompany();
    await store.recordFetch(board.id, FETCHED, { offset: 40, seen: ["a", "é"] });
    await store.linkCompany(board.id, companyId);
    await store.recordFetch(search.id, FAILED, null);
    expect(await store.list()).toEqual([
        { ...board, companyId, cursor: { offset: 40, seen: ["a", "é"] }, last: FETCHED },
        { ...SEARCH, id: search.id, companyId: null, cursor: null, last: FAILED },
    ]);
    expect(JSON.stringify((await store.list())[1]?.params)).toBe(JSON.stringify(SEARCH.params));
    return search;
}

async function addsAccountSourceOnce(store: UserSourceStore): Promise<void> {
    await store.ensureAccountSource({ module: "gmail_alerts", name: "Gmail alerts" }, AT);
    await store.ensureAccountSource({ module: "gmail_alerts", name: "Gmail alerts" }, AT);
    const alerts = (await store.list()).filter((source) => source.module === "gmail_alerts");
    expect(alerts).toEqual([{ id: expect.any(Number), module: "gmail_alerts", name: "Gmail alerts", params: {}, target: "gmail_alerts", enabled: true, companyId: null, cursor: null, last: null }]);
}

async function relabelsThenUnlinksJobs(stores: TestStores, hooks: SourceHooks, board: SavedSource): Promise<void> {
    const job = makeJob({ ats: "greenhouse", jobId: "g1", company: "Stripe", title: "Engineer", url: "https://example.com/g1" }, {});
    await stores.jobStore.upsertAll([job], AT, { id: board.id, name: board.name });
    await stores.sources.save({ ...board, name: "Stripe, Inc." }, AT);
    expect(await hooks.jobLinks()).toEqual([{ job_id: "g1", source: "Stripe, Inc.", source_id: board.id }]);
    await stores.sources.remove(board.id);
    expect(await hooks.jobLinks()).toEqual([{ job_id: "g1", source: "Stripe, Inc.", source_id: null }]);
}

export function sourceContract(make: MakeStores, hooks: SourceHooks): void {
    test("saved sources are added, edited, refused when repeated, switched, recorded, renamed with their jobs, and removed", async () => {
        const stores = await make();
        const board = await savesAndEdits(stores.sources);
        await refusesRepeats(stores.sources, board);
        await switchesOffAndOn(stores.sources, board);
        const search = await keepsFetchesExactly(stores.sources, hooks, { ...board, enabled: true });
        await addsAccountSourceOnce(stores.sources);
        await relabelsThenUnlinksJobs(stores, hooks, board);
        expect((await stores.sources.list()).map((source) => source.id)).not.toContain(board.id);
        expect((await stores.sources.list()).map((source) => source.id)).toContain(search.id);
        await stores.close();
    });
    test("a source saved for a user that doesn't exist is refused", async () => {
        const stores = await make();
        await expect(stores.forUser(99).sources.save(BOARD, AT)).rejects.toThrow();
        expect(await stores.forUser(99).sources.list()).toEqual([]);
        await stores.close();
    });
}
