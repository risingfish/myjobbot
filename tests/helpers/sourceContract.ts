import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { NewSource, SavedSource, SourceOutcome, SourceStore } from "../../src/db/sourceStore.js";
import type { MakeStores } from "./storeContract.js";

export interface SourceHooks {
    seedCompany(): Promise<number>;
}

const AT = "2026-10-28T00:00:00.000Z";
const BOARD: NewSource = { module: "greenhouse", name: "Stripe", params: { slug: "stripe" }, target: "greenhouse:stripe", enabled: true };
const SEARCH: NewSource = { module: "jsearch", name: "Zürich remote 🚀", params: { query: "backend engineer", country: "ch", remote_only: true }, target: "jsearch:backend engineer|ch|true", enabled: true };
const FETCHED: SourceOutcome = { at: AT, outcome: "partial", jobs: 100, cost: 2, reason: null };
const FAILED: SourceOutcome = { at: AT, outcome: "failing", jobs: 0, cost: 0, reason: "not found" };

function key(source: SavedSource) {
    return { userId: OWNER_ID, id: source.id };
}

async function savesAndEdits(store: SourceStore): Promise<SavedSource> {
    expect(await store.list(OWNER_ID)).toEqual([]);
    const board = await store.save(OWNER_ID, BOARD, AT);
    expect(board).toEqual({ ...BOARD, id: expect.any(Number), companyId: null, cursor: null, last: null });
    await store.recordFetch(key(board), FETCHED, { offset: 20 });
    const edited = await store.save(OWNER_ID, { ...board, params: { slug: "stripe-inc" }, target: "greenhouse:stripe-inc" }, AT);
    expect(edited).toEqual({ ...BOARD, id: board.id, params: { slug: "stripe-inc" }, target: "greenhouse:stripe-inc", companyId: null, cursor: null, last: FETCHED });
    return edited;
}

async function refusesRepeats(store: SourceStore, board: SavedSource): Promise<void> {
    await expect(store.save(OWNER_ID, { ...SEARCH, target: board.target }, AT)).rejects.toThrow();
    await expect(store.save(OWNER_ID, { ...SEARCH, name: board.name }, AT)).rejects.toThrow();
    expect((await store.list(OWNER_ID)).map((source) => source.id)).toEqual([board.id]);
}

async function switchesOffAndOn(store: SourceStore, board: SavedSource): Promise<void> {
    await store.recordFetch(key(board), FETCHED, { offset: 40 });
    await store.setEnabled(key(board), false, AT);
    expect((await store.list(OWNER_ID))[0]).toMatchObject({ enabled: false, cursor: null });
    await store.recordFetch(key(board), FETCHED, { offset: 40 });
    await store.setEnabled(key(board), true, AT);
    expect((await store.list(OWNER_ID))[0]).toMatchObject({ enabled: true, cursor: null });
}

async function keepsFetchesExactly(store: SourceStore, hooks: SourceHooks, board: SavedSource): Promise<SavedSource> {
    const search = await store.save(OWNER_ID, SEARCH, AT);
    const companyId = await hooks.seedCompany();
    await store.recordFetch(key(board), FETCHED, { offset: 40, seen: ["a", "é"] });
    await store.linkCompany(key(board), companyId);
    await store.recordFetch(key(search), FAILED, null);
    expect(await store.list(OWNER_ID)).toEqual([
        { ...board, companyId, cursor: { offset: 40, seen: ["a", "é"] }, last: FETCHED },
        { ...SEARCH, id: search.id, companyId: null, cursor: null, last: FAILED },
    ]);
    expect(JSON.stringify((await store.list(OWNER_ID))[1]?.params)).toBe(JSON.stringify(SEARCH.params));
    return search;
}

async function addsAccountSourceOnce(store: SourceStore): Promise<void> {
    await store.ensureAccountSource(OWNER_ID, { module: "gmail_alerts", name: "Gmail alerts" }, AT);
    await store.ensureAccountSource(OWNER_ID, { module: "gmail_alerts", name: "Gmail alerts" }, AT);
    const alerts = (await store.list(OWNER_ID)).filter((source) => source.module === "gmail_alerts");
    expect(alerts).toEqual([{ id: expect.any(Number), module: "gmail_alerts", name: "Gmail alerts", params: {}, target: "gmail_alerts", enabled: true, companyId: null, cursor: null, last: null }]);
}

export function sourceContract(make: MakeStores, hooks: SourceHooks): void {
    test("saved sources are added, edited, refused when repeated, switched, recorded and removed", async () => {
        const stores = await make();
        const board = await savesAndEdits(stores.sources);
        await refusesRepeats(stores.sources, board);
        await switchesOffAndOn(stores.sources, board);
        const search = await keepsFetchesExactly(stores.sources, hooks, { ...board, enabled: true });
        await addsAccountSourceOnce(stores.sources);
        await stores.sources.remove(key(board));
        expect((await stores.sources.list(OWNER_ID)).map((source) => source.id)).not.toContain(board.id);
        expect((await stores.sources.list(OWNER_ID)).map((source) => source.id)).toContain(search.id);
        await stores.close();
    });
}
