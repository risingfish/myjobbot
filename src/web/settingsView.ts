import { z } from "zod";
import { fileConfigSchema, titleFilterTerms } from "../config/schema.js";
import { isRawObject, sanitizeSearchSettings, splitSettings } from "../config/searchSettings.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { SECTIONS, type FieldName } from "./settingsSections.js";

type RawEntry = Record<string, unknown>;

interface FieldValues {
    companies: RawEntry[];
    searches: RawEntry[];
    preferences: string;
    match_threshold: number;
    title_boosts: Array<[string, number]>;
    include: string[];
    exclude: string[];
    extra_exclude: string[];
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
    needsSource: boolean;
    needsSearchKey: boolean;
}

const entries = z.array(z.record(z.string(), z.unknown()));
const terms = z.array(z.string());

const SHOWN: { [K in FieldName]: z.ZodType<FieldValues[K]> } = {
    companies: entries,
    searches: entries,
    preferences: z.string(),
    match_threshold: z.number(),
    title_boosts: z.record(z.string(), z.number()).transform((boosts) => Object.entries(boosts)),
    include: terms,
    exclude: terms,
    extra_exclude: terms,
    exclude_companies: terms,
    exclude_publishers: terms,
};

const DEFAULTS: Record<FieldName, () => unknown> = {
    companies: () => fileConfigSchema.shape.companies.parse(undefined),
    searches: () => fileConfigSchema.shape.searches.parse(undefined),
    preferences: () => fileConfigSchema.shape.preferences.parse(undefined),
    match_threshold: () => fileConfigSchema.shape.match_threshold.parse(undefined),
    title_boosts: () => fileConfigSchema.shape.title_boosts.parse(undefined),
    include: () => titleFilterTerms.shape.include.parse(undefined),
    exclude: () => titleFilterTerms.shape.exclude.parse(undefined),
    extra_exclude: () => titleFilterTerms.shape.extra_exclude.parse(undefined),
    exclude_companies: () => fileConfigSchema.shape.exclude_companies.parse(undefined),
    exclude_publishers: () => fileConfigSchema.shape.jsearch.parse(undefined).exclude_publishers,
};

/** Builds what the Settings page shows: every search setting in effect after fallback, each marked when it takes its default, without running the cross-setting rules. */
export function settingsView(stored: RawSearchSettings | null, hasSearchKey: boolean): SettingsView {
    const { settings } = sanitizeSearchSettings(stored ?? {});
    const fields = shownFields(settings);
    const sources = fields.companies.value.length + fields.searches.value.length;
    return { fields, defaults: defaultValues(), needsSource: sources === 0, needsSearchKey: fields.searches.value.length > 0 && !hasSearchKey };
}

/** Reads config.json's Gmail settings from its runtime part alone, so they can be used before any search settings are stored. */
export function gmailSettings(fileRaw: unknown): z.infer<typeof fileConfigSchema.shape.gmail> {
    const { runtime } = splitSettings(fileRaw);
    return fileConfigSchema.shape.gmail.parse(isRawObject(runtime) ? runtime.gmail : undefined);
}

/** Shows each field of the sanitized settings. */
function shownFields(settings: RawSearchSettings): SettingsFields {
    return {
        companies: shownField("companies", settings),
        searches: shownField("searches", settings),
        preferences: shownField("preferences", settings),
        match_threshold: shownField("match_threshold", settings),
        title_boosts: shownField("title_boosts", settings),
        include: shownField("include", settings),
        exclude: shownField("exclude", settings),
        extra_exclude: shownField("extra_exclude", settings),
        exclude_companies: shownField("exclude_companies", settings),
        exclude_publishers: shownField("exclude_publishers", settings),
    };
}

/** Gives every field's default as the page shows it, for resetting a field on the page. */
function defaultValues(): SettingsView["defaults"] {
    const empty = shownFields({});
    return {
        companies: empty.companies.value,
        searches: empty.searches.value,
        preferences: empty.preferences.value,
        match_threshold: empty.match_threshold.value,
        title_boosts: empty.title_boosts.value,
        include: empty.include.value,
        exclude: empty.exclude.value,
        extra_exclude: empty.extra_exclude.value,
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
