import { expect, test } from "vitest";
import { resolveSettings, settingsNotices } from "../src/config/resolve.js";
import { splitSettings } from "../src/config/searchSettings.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { FULL_CONFIG } from "./helpers/config.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";

const SEARCH_KEYS = ["preferences", "match_threshold", "title_filter", "title_boosts", "exclude_companies", "jsearch.exclude_publishers"];
const STORED = { exclude_companies: ["acme"] };

function storedWith(settings: Record<string, unknown>): MemorySearchSettingsStore {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, settings);
    return store;
}

test("with nothing stored and no search settings in the file, every search setting takes its default and there are no notices", async () => {
    const resolved = await resolveSettings({ http: { timeout_s: 20 } }, new MemorySearchSettingsStore());
    expect([resolved.file.match_threshold, resolved.file.http.timeout_s, resolved.notices]).toEqual([70, 20, []]);
});

test("with nothing stored, the file's search settings are never imported or used", async () => {
    const store = new MemorySearchSettingsStore();
    expect((await resolveSettings(FULL_CONFIG, store)).file.match_threshold).toBe(70);
    expect(await store.load(OWNER_ID)).toBeNull();
});

test("with settings stored, the file's search settings are ignored and named in a notice", async () => {
    const resolved = await resolveSettings(FULL_CONFIG, storedWith(STORED));
    expect([resolved.file.exclude_companies, resolved.file.match_threshold, resolved.file.http.timeout_s]).toEqual([STORED.exclude_companies, 70, 20]);
    expect(resolved.notices).toEqual([{ kind: "file_ignored", keys: SEARCH_KEYS }]);
});

test("with settings stored and only runtime settings in the file, there are no notices", async () => {
    expect((await resolveSettings({ http: { timeout_s: 20 } }, storedWith(STORED))).notices).toEqual([]);
});

test("the joined settings are checked as a whole, runtime rules included", async () => {
    await expect(resolveSettings({ ghost_threshold_days: 90, job_retention_days: 60 }, storedWith(STORED))).rejects.toThrow(/job_retention_days/);
});

test("a bad stored setting falls back on its own and the rest are used as stored", async () => {
    const resolved = await resolveSettings({}, storedWith({ ...STORED, match_threshold: 150, preferences: "Remote" }));
    expect([resolved.file.match_threshold, resolved.file.preferences, resolved.file.exclude_companies, resolved.notices]).toEqual([70, "Remote", STORED.exclude_companies, [{ kind: "fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" }]]);
});

test("a stored document of nothing but bad values still resolves, every setting at its default", async () => {
    const resolved = await resolveSettings({}, storedWith({ match_threshold: "high", title_boosts: ["go"] }));
    expect([resolved.file.match_threshold, resolved.file.title_boosts, resolved.notices.length]).toEqual([70, {}, 2]);
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
