import { expect, test, vi } from "vitest";
import { resolveSettings } from "../src/config/resolve.js";
import { fileConfigSchema } from "../src/config/schema.js";
import { OWNER_ID, type SearchSettingsStore } from "../src/db/searchSettingsStore.js";
import { FULL_CONFIG, TEST_SEARCH } from "./helpers/config.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";

const AT = "2026-10-25T00:00:00.000Z";
const SEARCH_KEYS = ["companies", "searches", "preferences", "match_threshold", "title_filter", "title_boosts", "exclude_companies", "jsearch.exclude_publishers"];
const STORED = { companies: [{ name: "Acme", ats: "lever", slug: "acme" }] };

function storedWith(settings: Record<string, unknown>): MemorySearchSettingsStore {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, settings);
    return store;
}

test("with nothing stored, the file's search settings are imported once and used as the file would be", async () => {
    const store = new MemorySearchSettingsStore();
    expect(await resolveSettings(FULL_CONFIG, store, AT)).toEqual({ file: fileConfigSchema.parse(FULL_CONFIG), notices: [{ kind: "imported", keys: SEARCH_KEYS }] });
    expect((await resolveSettings(FULL_CONFIG, store, AT)).notices).toEqual([{ kind: "file_ignored", keys: SEARCH_KEYS }]);
    expect(await store.load(OWNER_ID)).toMatchObject({ match_threshold: 60, exclude_publishers: ["jobmesh.io"] });
});

test("with nothing stored and no search settings in the file, nothing is stored and the file is checked as today", async () => {
    const store = new MemorySearchSettingsStore();
    await expect(resolveSettings({ http: { timeout_s: 20 } }, store, AT)).rejects.toThrow(/at least one company or search/);
    expect(await store.load(OWNER_ID)).toBeNull();
});

test("invalid search settings in the file are refused with today's message and nothing is stored", async () => {
    const store = new MemorySearchSettingsStore();
    await expect(resolveSettings({ ...FULL_CONFIG, match_threshold: 150 }, store, AT)).rejects.toThrow(/expected number to be <=100/);
    expect(await store.load(OWNER_ID)).toBeNull();
});

test("with settings stored, the file's search settings are ignored and named in a notice", async () => {
    const resolved = await resolveSettings(FULL_CONFIG, storedWith(STORED), AT);
    expect([resolved.file.companies, resolved.file.searches, resolved.file.http.timeout_s]).toEqual([STORED.companies, [], 20]);
    expect(resolved.notices).toEqual([{ kind: "file_ignored", keys: SEARCH_KEYS }]);
});

test("with settings stored and only runtime settings in the file, there are no notices", async () => {
    expect((await resolveSettings({ http: { timeout_s: 20 } }, storedWith(STORED), AT)).notices).toEqual([]);
});

test("a rule spanning both places is checked against the file's runtime settings", async () => {
    await expect(resolveSettings({ jsearch: { monthly_request_cap: 10 } }, storedWith({ searches: [TEST_SEARCH] }), AT)).rejects.toThrow(/monthly_request_cap/);
});

test("losing the import race uses the settings the other process stored", async () => {
    const store: SearchSettingsStore = { load: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(STORED), importIfAbsent: async () => false };
    const resolved = await resolveSettings(FULL_CONFIG, store, AT);
    expect([resolved.file.companies, resolved.notices.map((notice) => notice.kind)]).toEqual([STORED.companies, ["file_ignored"]]);
});

test("an import that stored nothing and left nothing stored is refused", async () => {
    const store: SearchSettingsStore = { load: async () => null, importIfAbsent: async () => false };
    await expect(resolveSettings(FULL_CONFIG, store, AT)).rejects.toThrow("search settings could not be stored");
});
