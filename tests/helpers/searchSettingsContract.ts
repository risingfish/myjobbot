import { expect, test } from "vitest";
import { OWNER_ID, type SearchSettingsStore } from "../../src/db/searchSettingsStore.js";
import type { MakeStores } from "./storeContract.js";

export interface SearchSettingsHooks {
    owners(): Promise<number[]>;
    seedUser(id: number): Promise<void>;
}

const AT = "2026-10-25T00:00:00.000Z";

const DOCUMENT = {
    searches: [
        { name: "Zürich remote 🚀", query: "backend engineer" },
        { name: "Berlin", query: "go developer" },
    ],
    preferences: "Remote — senior, ünd 🎯\nsecond line",
    title_boosts: { typescript: 10, café: 5 },
    exclude_publishers: ["jobmesh.io"],
};

async function nothingStoredYet(store: SearchSettingsStore): Promise<void> {
    expect(await store.load(OWNER_ID)).toBeNull();
}

async function savesFirst(store: SearchSettingsStore): Promise<void> {
    await store.save(OWNER_ID, DOCUMENT, AT);
}

async function roundTripsExactly(store: SearchSettingsStore): Promise<void> {
    expect(JSON.stringify(await store.load(OWNER_ID))).toBe(JSON.stringify(DOCUMENT));
}

async function savesWholePerUser(store: SearchSettingsStore, hooks: SearchSettingsHooks): Promise<void> {
    await store.save(OWNER_ID, { match_threshold: 50 }, AT);
    expect(await store.load(OWNER_ID)).toEqual({ match_threshold: 50 });
    await expect(store.save(2, { match_threshold: 40 }, AT)).rejects.toThrow();
    expect(await store.load(2)).toBeNull();
    await hooks.seedUser(2);
    await store.save(2, { match_threshold: 40 }, AT);
    expect([await store.load(2), await store.load(OWNER_ID)]).toEqual([{ match_threshold: 40 }, { match_threshold: 50 }]);
}

export function searchSettingsContract(make: MakeStores, hooks: SearchSettingsHooks): void {
    test("search settings round-trip exactly, create the one owner with the first save, and are replaced whole per user", async () => {
        const stores = await make();
        await nothingStoredYet(stores.searchSettings);
        await savesFirst(stores.searchSettings);
        await roundTripsExactly(stores.searchSettings);
        expect(await hooks.owners()).toEqual([OWNER_ID]);
        await savesWholePerUser(stores.searchSettings, hooks);
        await stores.close();
    });
}
