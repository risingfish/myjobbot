import { expect, test } from "vitest";
import { OWNER_ID, type UserSearchSettingsStore } from "../../src/db/searchSettingsStore.js";
import type { TestStores } from "./memoryStore.js";
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

async function nothingStoredYet(store: UserSearchSettingsStore): Promise<void> {
    expect(await store.load()).toBeNull();
}

async function savesFirst(store: UserSearchSettingsStore): Promise<void> {
    await store.save(DOCUMENT, AT);
}

async function roundTripsExactly(store: UserSearchSettingsStore): Promise<void> {
    expect(JSON.stringify(await store.load())).toBe(JSON.stringify(DOCUMENT));
}

async function savesWholePerUser(stores: TestStores, hooks: SearchSettingsHooks): Promise<void> {
    const other = stores.forUser(2).searchSettings;
    await stores.searchSettings.save({ match_threshold: 50 }, AT);
    expect(await stores.searchSettings.load()).toEqual({ match_threshold: 50 });
    await expect(other.save({ match_threshold: 40 }, AT)).rejects.toThrow();
    expect(await other.load()).toBeNull();
    await hooks.seedUser(2);
    await other.save({ match_threshold: 40 }, AT);
    expect([await other.load(), await stores.searchSettings.load()]).toEqual([{ match_threshold: 40 }, { match_threshold: 50 }]);
}

export function searchSettingsContract(make: MakeStores, hooks: SearchSettingsHooks): void {
    test("search settings round-trip exactly, create the one owner with the first save, and are replaced whole per user", async () => {
        const stores = await make();
        await nothingStoredYet(stores.searchSettings);
        await savesFirst(stores.searchSettings);
        await roundTripsExactly(stores.searchSettings);
        expect(await hooks.owners()).toEqual([OWNER_ID]);
        await savesWholePerUser(stores, hooks);
        await stores.close();
    });
}
