import { z } from "zod";
import { bodyFilterTerms, RESUME_VIEWS, settingsSchema, titleFilterTerms, type ResumeView, type Settings } from "../config/schema.js";
import { isRawObject, sanitizeSearchSettings, splitSettings } from "../config/searchSettings.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { SECTIONS, type FieldName } from "./settingsSections.js";

interface FieldValues {
    preferences: string;
    match_threshold: number;
    resume_view: ResumeView;
    title_boosts: Array<[string, number]>;
    description_boosts: Array<[string, number]>;
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
}

const terms = z.array(z.string());

const boostRows = z.record(z.string(), z.number()).transform((boosts) => Object.entries(boosts));

const SHOWN: { [K in FieldName]: z.ZodType<FieldValues[K]> } = {
    preferences: z.string(),
    match_threshold: z.number(),
    resume_view: z.enum(RESUME_VIEWS),
    title_boosts: boostRows,
    description_boosts: boostRows,
    include: terms,
    exclude: terms,
    extra_exclude: terms,
    body_include: terms,
    body_exclude: terms,
    exclude_companies: terms,
    exclude_publishers: terms,
};

const DEFAULTS: Record<FieldName, () => unknown> = {
    preferences: () => settingsSchema.shape.preferences.parse(undefined),
    match_threshold: () => settingsSchema.shape.match_threshold.parse(undefined),
    resume_view: () => settingsSchema.shape.resume_view.parse(undefined),
    title_boosts: () => settingsSchema.shape.title_boosts.parse(undefined),
    description_boosts: () => settingsSchema.shape.description_boosts.parse(undefined),
    include: () => titleFilterTerms.shape.include.parse(undefined),
    exclude: () => titleFilterTerms.shape.exclude.parse(undefined),
    extra_exclude: () => titleFilterTerms.shape.extra_exclude.parse(undefined),
    body_include: () => bodyFilterTerms.shape.include.parse(undefined),
    body_exclude: () => bodyFilterTerms.shape.exclude.parse(undefined),
    exclude_companies: () => settingsSchema.shape.exclude_companies.parse(undefined),
    exclude_publishers: () => settingsSchema.shape.jsearch.parse(undefined).exclude_publishers,
};

/** Builds what the Settings page shows: every search setting in effect after fallback, each marked when it isn't stored, so an untouched field saves as unset. */
export function settingsView(stored: RawSearchSettings | null): SettingsView {
    const { settings } = sanitizeSearchSettings(stored ?? {});
    return { fields: shownFields(settings) };
}

/** Reads config.json's Gmail settings from its runtime part alone, so they can be used before any search settings are stored. */
export function gmailSettings(fileRaw: unknown): z.infer<typeof settingsSchema.shape.gmail> {
    return settingsSchema.shape.gmail.parse(runtimePart(fileRaw, "gmail"));
}

/** Reads config.json's HTTP and JSearch settings from its runtime part alone, so the Sources section works before any search settings are stored. */
export function sourceSettings(fileRaw: unknown): Pick<Settings, "http" | "jsearch"> {
    return { http: settingsSchema.shape.http.parse(runtimePart(fileRaw, "http")), jsearch: settingsSchema.shape.jsearch.parse(runtimePart(fileRaw, "jsearch")) };
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
        resume_view: shownField("resume_view", settings),
        title_boosts: shownField("title_boosts", settings),
        description_boosts: shownField("description_boosts", settings),
        include: shownField("include", settings),
        exclude: shownField("exclude", settings),
        extra_exclude: shownField("extra_exclude", settings),
        body_include: shownField("body_include", settings),
        body_exclude: shownField("body_exclude", settings),
        exclude_companies: shownField("exclude_companies", settings),
        exclude_publishers: shownField("exclude_publishers", settings),
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
