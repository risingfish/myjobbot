import { z } from "zod";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { boostPoints, settingsSchema, filterTerm, publisherTerm } from "./schema.js";

const PUBLISHERS = "exclude_publishers";

const DOMAIN_REASON = "not a valid domain entry";

const NOT_SEARCH = "not a search setting";

const FILTER_LISTS = new Set(["include", "exclude", "extra_exclude"]);

const BOOST_ENTRY = z.tuple([filterTerm, boostPoints]);

type RawObject = Record<string, unknown>;

type Sanitizer = (value: unknown, fallbacks: Fallbacks) => unknown;

interface ListRule {
    name: string;
    entry: z.ZodType;
    reason?: (entry: unknown, error: z.ZodError) => string;
}

export interface SplitSettings {
    search: RawSearchSettings;
    runtime: unknown;
}

export interface FallbackNotice {
    kind: "fallback";
    setting: string;
    reason: string;
}

const SANITIZERS: Record<string, Sanitizer> = {
    preferences: (value, fallbacks) => fallbacks.checked(settingsSchema.shape.preferences, value, "preferences"),
    match_threshold: (value, fallbacks) => fallbacks.checked(settingsSchema.shape.match_threshold, value, "match_threshold"),
    title_filter: (value, fallbacks) => fallbacks.filterLists(value, "title_filter"),
    body_filter: (value, fallbacks) => fallbacks.filterLists(value, "body_filter"),
    title_boosts: (value, fallbacks) => fallbacks.boosts(value),
    exclude_companies: (value, fallbacks) => fallbacks.list(value, { name: "exclude_companies", entry: filterTerm }),
    [PUBLISHERS]: (value, fallbacks) => fallbacks.list(value, { name: `jsearch.${PUBLISHERS}`, entry: publisherTerm, reason: publisherReason }),
};

const RETIRED_KEYS = ["companies", "searches"];

const TOP_LEVEL_KEYS = new Set(Object.keys(SANITIZERS).filter((key) => key !== PUBLISHERS));

/** Reports whether a raw JSON value is an object of named values, not a list or a scalar. */
export function isRawObject(value: unknown): value is RawObject {
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
        .filter((key) => Object.hasOwn(SANITIZERS, key))
        .map((key) => (key === PUBLISHERS ? `jsearch.${PUBLISHERS}` : key));
}

/** Names the settings no longer read from config.json or the stored document, since boards and searches became saved sources, wherever either still holds them. */
export function retiredKeys(split: SplitSettings, stored: RawSearchSettings | null): string[] {
    const inFile = isRawObject(split.runtime) ? split.runtime : {};
    return RETIRED_KEYS.filter((key) => key in inFile || (stored !== null && key in stored));
}

/** Checks each stored search setting against its own rules, dropping bad values and entries so their defaults apply, with one notice per drop and never the dropped value. */
export function sanitizeSearchSettings(stored: RawSearchSettings): { settings: RawSearchSettings; notices: FallbackNotice[] } {
    const fallbacks = new Fallbacks();
    const settings: RawSearchSettings = {};
    for (const [key, value] of Object.entries(stored)) {
        if (RETIRED_KEYS.includes(key)) continue;
        const sanitizer = Object.hasOwn(SANITIZERS, key) ? SANITIZERS[key] : undefined;
        const kept = sanitizer === undefined ? fallbacks.report(key, NOT_SEARCH) : sanitizer(value, fallbacks);
        if (kept !== undefined) settings[key] = kept;
    }
    return { settings, notices: fallbacks.notices };
}

/** Returns the zod issue message that says why a value failed. */
function firstIssue(error: z.ZodError): string {
    return error.issues[0]?.message ?? "invalid";
}

/** Says why an excluded publisher failed without repeating it, since the domain check's own message holds the entry. */
function publisherReason(entry: unknown, error: z.ZodError): string {
    return filterTerm.safeParse(entry).success ? DOMAIN_REASON : firstIssue(error);
}

class Fallbacks {
    readonly notices: FallbackNotice[] = [];

    /** Records that a stored setting or entry fell back, and why, returning nothing to keep. */
    report(setting: string, reason: string): undefined {
        this.notices.push({ kind: "fallback", setting, reason });
        return undefined;
    }

    /** Returns a value that passes its schema, or records it as fallen back under its name. */
    checked(schema: z.ZodType, value: unknown, name: string): unknown {
        const result = schema.safeParse(value);
        return result.success ? value : this.report(name, firstIssue(result.error));
    }

    /** Keeps the entries of a stored list that pass, recording each other one by its position; a list with none left takes its default. */
    list(value: unknown, rule: ListRule): unknown {
        if (!Array.isArray(value)) return this.checked(z.array(z.unknown()), value, rule.name);
        const kept = value.filter((entry, index) => this.keeps(entry, `${rule.name}[${index}]`, rule));
        return kept.length === 0 && value.length > 0 ? undefined : kept;
    }

    /** Keeps the passing terms of each stored list of a title or body filter, dropping a list with none left so its default applies. */
    filterLists(value: unknown, name: string): unknown {
        if (!isRawObject(value)) return this.checked(z.object({}), value, name);
        const parts = Object.entries(value).map(([key, terms]) => [key, FILTER_LISTS.has(key) ? this.list(terms, { name: `${name}.${key}`, entry: filterTerm }) : terms]);
        return Object.fromEntries(parts.filter(([, terms]) => terms !== undefined));
    }

    /** Keeps the stored title boosts whose term and points both pass, recording each other one by its position. */
    boosts(value: unknown): unknown {
        if (!isRawObject(value)) return this.checked(z.record(z.string(), z.unknown()), value, "title_boosts");
        const entries = Object.entries(value);
        const kept = entries.filter((entry, index) => this.keeps(entry, `title_boosts[${index}]`, { name: "title_boosts", entry: BOOST_ENTRY }));
        return kept.length === 0 && entries.length > 0 ? undefined : Object.fromEntries(kept);
    }

    /** Reports whether one entry passes its rule, recording it under its position when it doesn't. */
    private keeps(entry: unknown, setting: string, rule: ListRule): boolean {
        const result = rule.entry.safeParse(entry);
        if (result.success) return true;
        this.report(setting, rule.reason === undefined ? firstIssue(result.error) : rule.reason(entry, result.error));
        return false;
    }
}
