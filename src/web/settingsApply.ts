import { isRawObject, sanitizeSearchSettings } from "../config/searchSettings.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import type { SaveRequest } from "./settingsForm.js";
import { fieldsOf, SECTIONS, type FieldName } from "./settingsSections.js";

const ROOTS = new Set(SECTIONS.map((field) => field.stored[0]));

interface AppliedSection {
    toStore: RawSearchSettings;
    toCheck: RawSearchSettings;
}

/** Applies one section's save to the stored settings: the document to store keeps the other sections exactly as stored, and the document to check holds them after fallback, so only the section's own values must pass strictly. */
export function applySection(stored: RawSearchSettings | null, request: SaveRequest): AppliedSection {
    const kept = Object.fromEntries(Object.entries(stored ?? {}).filter(([key]) => ROOTS.has(key)));
    const others = fieldsOf(request.section).reduce((doc, field) => setAt(doc, field.stored, undefined), kept);
    return { toStore: withEdits(kept, request), toCheck: withEdits(sanitizeSearchSettings(others).settings, request) };
}

/** Writes a request's edits into a settings document at each field's stored path. */
function withEdits(doc: RawSearchSettings, request: SaveRequest): RawSearchSettings {
    return fieldsOf(request.section).reduce((next, field) => setAt(next, field.stored, editedValue(field.name, request)), doc);
}

/** Gives the value a field is stored with after an edit, or undefined when it goes back to its default; boost rows become a map in row order. */
function editedValue(name: FieldName, request: SaveRequest): unknown {
    const edit = request.edits[name];
    if (edit === undefined || edit.kind === "default") return undefined;
    if (name !== "title_boosts" || !Array.isArray(edit.value)) return edit.value;
    return Object.fromEntries(edit.value.filter(Array.isArray).map(([term, points]: unknown[]) => [String(term), points]));
}

/** Sets or removes a value at a path in a settings document, keeping the keys' order and dropping a nested object left empty. */
function setAt(doc: RawSearchSettings, path: string[], value: unknown): RawSearchSettings {
    const [key = "", ...rest] = path;
    const inner = doc[key];
    const next = rest.length === 0 ? value : setAt(isRawObject(inner) ? inner : {}, rest, value);
    const emptied = next === undefined || (rest.length > 0 && isRawObject(next) && Object.keys(next).length === 0);
    if (emptied) return Object.fromEntries(Object.entries(doc).filter(([name]) => name !== key));
    if (!Object.hasOwn(doc, key)) return { ...doc, [key]: next };
    return Object.fromEntries(Object.entries(doc).map(([name, current]) => [name, name === key ? next : current]));
}
