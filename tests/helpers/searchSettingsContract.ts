import { expect, test } from "vitest";
import { OWNER_ID, type SearchSettingsStore } from "../../src/db/searchSettingsStore.js";
import type { MakeStores } from "./storeContract.js";

export interface SearchSettingsHooks {
    owners(): Promise<number[]>;
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

async function importsOnce(store: SearchSettingsStore): Promise<void> {
    expect(await store.importIfAbsent(DOCUMENT, AT)).toBe(true);
    expect(await store.importIfAbsent({ match_threshold: 50 }, AT)).toBe(false);
}

async function roundTripsExactly(store: SearchSettingsStore): Promise<void> {
    expect(JSON.stringify(await store.load(OWNER_ID))).toBe(JSON.stringify(DOCUMENT));
}

export function searchSettingsContract(make: MakeStores, hooks: SearchSettingsHooks): void {
    test("search settings are imported once, round-trip exactly, and create the one owner with them", async () => {
        const stores = await make();
        await nothingStoredYet(stores.searchSettings);
        await importsOnce(stores.searchSettings);
        await roundTripsExactly(stores.searchSettings);
        expect(await hooks.owners()).toEqual([OWNER_ID]);
        await stores.close();
    });
}
