import { expect, test, vi } from "vitest";
import { resolveSettings, settingsNotices } from "../src/config/resolve.js";
import { splitSettings } from "../src/config/searchSettings.js";
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
    const store: SearchSettingsStore = { load: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(STORED), importIfAbsent: async () => false, save: async () => {} };
    const resolved = await resolveSettings(FULL_CONFIG, store, AT);
    expect([resolved.file.companies, resolved.notices.map((notice) => notice.kind)]).toEqual([STORED.companies, ["file_ignored"]]);
});

test("an import that stored nothing and left nothing stored is refused", async () => {
    const store: SearchSettingsStore = { load: async () => null, importIfAbsent: async () => false, save: async () => {} };
    await expect(resolveSettings(FULL_CONFIG, store, AT)).rejects.toThrow("search settings could not be stored");
});

test("a bad stored setting falls back on its own and the rest are used as stored", async () => {
    const resolved = await resolveSettings({}, storedWith({ ...STORED, match_threshold: 150, preferences: "Remote" }), AT);
    expect([resolved.file.match_threshold, resolved.file.preferences, resolved.file.companies, resolved.notices]).toEqual([70, "Remote", STORED.companies, [{ kind: "fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" }]]);
});

test("a cross-setting rule that still fails after falling back is refused with today's message", async () => {
    await expect(resolveSettings({}, storedWith({ companies: [{ name: "X", ats: "workday", slug: "x" }] }), AT)).rejects.toThrow(/at least one company or search/);
});

test("the settings notices are the fallbacks and the file's leftover search settings, the same ones resolving reports", async () => {
    const stored = { ...STORED, match_threshold: 150 };
    const notices = settingsNotices(splitSettings(FULL_CONFIG), stored);
    expect(notices).toEqual([
        { kind: "fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" },
        { kind: "file_ignored", keys: SEARCH_KEYS },
    ]);
    expect((await resolveSettings(FULL_CONFIG, storedWith(stored), AT)).notices).toEqual(notices);
});
