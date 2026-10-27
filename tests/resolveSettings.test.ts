import { expect, test } from "vitest";
import { resolveSettings, settingsNotices } from "../src/config/resolve.js";
import { splitSettings } from "../src/config/searchSettings.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { FULL_CONFIG, TEST_SEARCH } from "./helpers/config.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";

const SEARCH_KEYS = ["companies", "searches", "preferences", "match_threshold", "title_filter", "title_boosts", "exclude_companies", "jsearch.exclude_publishers"];
const STORED = { companies: [{ name: "Acme", ats: "lever", slug: "acme" }] };

function storedWith(settings: Record<string, unknown>): MemorySearchSettingsStore {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, settings);
    return store;
}

test("with nothing stored and no search settings in the file, the file is checked as today", async () => {
    await expect(resolveSettings({ http: { timeout_s: 20 } }, new MemorySearchSettingsStore())).rejects.toThrow(/at least one company or search/);
});

test("with nothing stored, the file's search settings are never imported or used", async () => {
    const store = new MemorySearchSettingsStore();
    await expect(resolveSettings(FULL_CONFIG, store)).rejects.toThrow(/at least one company or search/);
    expect(await store.load(OWNER_ID)).toBeNull();
});

test("with settings stored, the file's search settings are ignored and named in a notice", async () => {
    const resolved = await resolveSettings(FULL_CONFIG, storedWith(STORED));
    expect([resolved.file.companies, resolved.file.searches, resolved.file.http.timeout_s]).toEqual([STORED.companies, [], 20]);
    expect(resolved.notices).toEqual([{ kind: "file_ignored", keys: SEARCH_KEYS }]);
});

test("with settings stored and only runtime settings in the file, there are no notices", async () => {
    expect((await resolveSettings({ http: { timeout_s: 20 } }, storedWith(STORED))).notices).toEqual([]);
});

test("a rule spanning both places is checked against the file's runtime settings", async () => {
    await expect(resolveSettings({ jsearch: { monthly_request_cap: 10 } }, storedWith({ searches: [TEST_SEARCH] }))).rejects.toThrow(/monthly_request_cap/);
});

test("a bad stored setting falls back on its own and the rest are used as stored", async () => {
    const resolved = await resolveSettings({}, storedWith({ ...STORED, match_threshold: 150, preferences: "Remote" }));
    expect([resolved.file.match_threshold, resolved.file.preferences, resolved.file.companies, resolved.notices]).toEqual([70, "Remote", STORED.companies, [{ kind: "fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" }]]);
});

test("a cross-setting rule that still fails after falling back is refused with today's message", async () => {
    await expect(resolveSettings({}, storedWith({ companies: [{ name: "X", ats: "workday", slug: "x" }] }))).rejects.toThrow(/at least one company or search/);
});

test("the settings notices are the fallbacks and the file's leftover search settings, the same ones resolving reports", async () => {
    const stored = { ...STORED, match_threshold: 150 };
    const notices = settingsNotices(splitSettings(FULL_CONFIG), stored);
    expect(notices).toEqual([
        { kind: "fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" },
        { kind: "file_ignored", keys: SEARCH_KEYS },
    ]);
    expect((await resolveSettings(FULL_CONFIG, storedWith(stored))).notices).toEqual(notices);
    expect(settingsNotices(splitSettings(FULL_CONFIG), null)).toEqual([{ kind: "file_ignored", keys: SEARCH_KEYS }]);
});
