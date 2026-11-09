import { z } from "zod";
import { bodyFilterTerms, RESUME_VIEWS, settingsSchema, titleFilterTerms, type ResumeView } from "../config/schema.js";
import { isRawObject, sanitizeSearchSettings } from "../config/searchSettings.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { SECTIONS, type FieldName, type FieldSpec } from "./settingsSections.js";

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

/** Shows each field of the sanitized settings, one for every field the sections list. */
function shownFields(settings: RawSearchSettings): SettingsFields {
    return Object.fromEntries(SECTIONS.map((spec) => [spec.name, shownField(spec, settings)])) as SettingsFields;
}

/** Shows one field: its stored value, or its default when it isn't stored. */
function shownField<K extends FieldName>(spec: FieldSpec & { name: K }, settings: RawSearchSettings): FieldView<FieldValues[K]> {
    const stored = storedValue(settings, spec);
    return { value: SHOWN[spec.name].parse(stored ?? DEFAULTS[spec.name]()), isDefault: stored === undefined };
}

/** Finds a field's value in a settings document by the field's stored path. */
function storedValue(settings: RawSearchSettings, spec: FieldSpec): unknown {
    return spec.stored.reduce<unknown>((value, key) => (isRawObject(value) ? value[key] : undefined), settings);
}
