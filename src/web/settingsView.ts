import { z } from "zod";
import { bodyFilterTerms, fileConfigSchema, titleFilterTerms, type FileConfig } from "../config/schema.js";
import { isRawObject, sanitizeSearchSettings, splitSettings } from "../config/searchSettings.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { SECTIONS, type FieldName } from "./settingsSections.js";

interface FieldValues {
    preferences: string;
    match_threshold: number;
    title_boosts: Array<[string, number]>;
    include: string[];
    exclude: string[];
    extra_exclude: string[];
    body_include: string[];
    body_exclude: string[];
    exclude_companies: string[];
    exclude_publishers: string[];
}

export interface FieldView<T> {
    value: T;
    isDefault: boolean;
}

type SettingsFields = { [K in FieldName]: FieldView<FieldValues[K]> };

export interface SettingsView {
    fields: SettingsFields;
    defaults: { [K in FieldName]: FieldValues[K] };
}

const terms = z.array(z.string());

const SHOWN: { [K in FieldName]: z.ZodType<FieldValues[K]> } = {
    preferences: z.string(),
    match_threshold: z.number(),
    title_boosts: z.record(z.string(), z.number()).transform((boosts) => Object.entries(boosts)),
    include: terms,
    exclude: terms,
    extra_exclude: terms,
    body_include: terms,
    body_exclude: terms,
    exclude_companies: terms,
    exclude_publishers: terms,
};

const DEFAULTS: Record<FieldName, () => unknown> = {
    preferences: () => fileConfigSchema.shape.preferences.parse(undefined),
    match_threshold: () => fileConfigSchema.shape.match_threshold.parse(undefined),
    title_boosts: () => fileConfigSchema.shape.title_boosts.parse(undefined),
    include: () => titleFilterTerms.shape.include.parse(undefined),
    exclude: () => titleFilterTerms.shape.exclude.parse(undefined),
    extra_exclude: () => titleFilterTerms.shape.extra_exclude.parse(undefined),
    body_include: () => bodyFilterTerms.shape.include.parse(undefined),
    body_exclude: () => bodyFilterTerms.shape.exclude.parse(undefined),
    exclude_companies: () => fileConfigSchema.shape.exclude_companies.parse(undefined),
    exclude_publishers: () => fileConfigSchema.shape.jsearch.parse(undefined).exclude_publishers,
};

/** Builds what the Settings page shows: every search setting in effect after fallback, each marked when it takes its default. */
export function settingsView(stored: RawSearchSettings | null): SettingsView {
    const { settings } = sanitizeSearchSettings(stored ?? {});
    return { fields: shownFields(settings), defaults: defaultValues() };
}

/** Reads config.json's Gmail settings from its runtime part alone, so they can be used before any search settings are stored. */
export function gmailSettings(fileRaw: unknown): z.infer<typeof fileConfigSchema.shape.gmail> {
    return fileConfigSchema.shape.gmail.parse(runtimePart(fileRaw, "gmail"));
}

/** Reads config.json's HTTP and JSearch settings from its runtime part alone, so the Sources section works before any search settings are stored. */
export function sourceSettings(fileRaw: unknown): Pick<FileConfig, "http" | "jsearch"> {
    return { http: fileConfigSchema.shape.http.parse(runtimePart(fileRaw, "http")), jsearch: fileConfigSchema.shape.jsearch.parse(runtimePart(fileRaw, "jsearch")) };
}

/** Picks one key of config.json's runtime part, or undefined so its defaults apply. */
function runtimePart(fileRaw: unknown, key: string): unknown {
    const { runtime } = splitSettings(fileRaw);
    return isRawObject(runtime) ? runtime[key] : undefined;
}

/** Shows each field of the sanitized settings. */
function shownFields(settings: RawSearchSettings): SettingsFields {
    return {
        preferences: shownField("preferences", settings),
        match_threshold: shownField("match_threshold", settings),
        title_boosts: shownField("title_boosts", settings),
        include: shownField("include", settings),
        exclude: shownField("exclude", settings),
        extra_exclude: shownField("extra_exclude", settings),
        body_include: shownField("body_include", settings),
        body_exclude: shownField("body_exclude", settings),
        exclude_companies: shownField("exclude_companies", settings),
        exclude_publishers: shownField("exclude_publishers", settings),
    };
}

/** Gives every field's default as the page shows it, for resetting a field on the page. */
function defaultValues(): SettingsView["defaults"] {
    const empty = shownFields({});
    return {
        preferences: empty.preferences.value,
        match_threshold: empty.match_threshold.value,
        title_boosts: empty.title_boosts.value,
        include: empty.include.value,
        exclude: empty.exclude.value,
        extra_exclude: empty.extra_exclude.value,
        body_include: empty.body_include.value,
        body_exclude: empty.body_exclude.value,
        exclude_companies: empty.exclude_companies.value,
        exclude_publishers: empty.exclude_publishers.value,
    };
}

/** Shows one field: its stored value, or its default when it isn't stored. */
function shownField<K extends FieldName>(name: K, settings: RawSearchSettings): FieldView<FieldValues[K]> {
    const stored = storedValue(settings, name);
    return { value: SHOWN[name].parse(stored ?? DEFAULTS[name]()), isDefault: stored === undefined };
}

/** Finds a field's value in a settings document by the field's stored path. */
function storedValue(settings: RawSearchSettings, name: FieldName): unknown {
    const path = SECTIONS.find((field) => field.name === name)?.stored ?? [];
    return path.reduce<unknown>((value, key) => (isRawObject(value) ? value[key] : undefined), settings);
}
