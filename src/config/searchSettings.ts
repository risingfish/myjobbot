import type { RawSearchSettings } from "../db/searchSettingsStore.js";

const PUBLISHERS = "exclude_publishers";

const TOP_LEVEL_KEYS = new Set(["companies", "searches", "preferences", "match_threshold", "title_filter", "title_boosts", "exclude_companies"]);

type RawObject = Record<string, unknown>;

export interface SplitSettings {
    search: RawSearchSettings;
    runtime: unknown;
}

/** Reports whether a raw JSON value is an object of named values, not a list or a scalar. */
function isRawObject(value: unknown): value is RawObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps only the entries of an object whose key passes a test. */
function entriesWhere(raw: RawObject, keep: (key: string) => boolean): RawObject {
    return Object.fromEntries(Object.entries(raw).filter(([key]) => keep(key)));
}

/** Splits a raw config.json value into its search settings, with JSearch's excluded publishers at the top level, and its runtime settings. */
export function splitSettings(raw: unknown): SplitSettings {
    if (!isRawObject(raw)) return { search: {}, runtime: raw };
    const search = entriesWhere(raw, (key) => TOP_LEVEL_KEYS.has(key));
    const runtime = entriesWhere(raw, (key) => !TOP_LEVEL_KEYS.has(key));
    if (!isRawObject(raw.jsearch) || !(PUBLISHERS in raw.jsearch)) return { search, runtime };
    const jsearch = entriesWhere(raw.jsearch, (key) => key !== PUBLISHERS);
    const rest = entriesWhere(runtime, (key) => key !== "jsearch");
    return { search: { ...search, [PUBLISHERS]: raw.jsearch[PUBLISHERS] }, runtime: Object.keys(jsearch).length > 0 ? { ...rest, jsearch } : rest };
}

/** Joins runtime settings with stored search settings into the raw shape config.json has, taking only search keys from the search part. */
export function mergeSettings(runtime: unknown, search: RawSearchSettings): unknown {
    if (!isRawObject(runtime)) return runtime;
    const merged = { ...runtime, ...entriesWhere(search, (key) => TOP_LEVEL_KEYS.has(key)) };
    if (!(PUBLISHERS in search)) return merged;
    if (runtime.jsearch !== undefined && !isRawObject(runtime.jsearch)) return merged;
    return { ...merged, jsearch: { ...runtime.jsearch, [PUBLISHERS]: search[PUBLISHERS] } };
}

/** Names the settings in a search part as config.json does, with the excluded publishers inside jsearch. */
export function settingNames(search: RawSearchSettings): string[] {
    return Object.keys(search)
        .filter((key) => TOP_LEVEL_KEYS.has(key) || key === PUBLISHERS)
        .map((key) => (key === PUBLISHERS ? `jsearch.${PUBLISHERS}` : key));
}
