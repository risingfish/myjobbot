import { settingsSchema } from "../config/schema.js";
import { mergeSettings } from "../config/searchSettings.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { applySection } from "./settingsApply.js";
import type { SaveRequest } from "./settingsForm.js";
import { repeatedBoosts, sectionProblems, type Problem } from "./settingsProblems.js";

export type SaveResult = { ok: true } | { ok: false; problems: Problem[] } | { ok: false; failed: true };

type SectionSave = { toStore: RawSearchSettings } | { problems: Problem[] };

/** Decides one section's save: the document to store when the section's values pass every rule together with the rest of the settings, or the problems to show. */
export function saveSection(stored: RawSearchSettings | null, runtime: unknown, request: SaveRequest): SectionSave {
    const repeated = repeatedBoosts(request);
    if (repeated.length > 0) return { problems: repeated };
    const { toStore, toCheck } = applySection(stored, request);
    const result = settingsSchema.safeParse(mergeSettings(runtime, toCheck));
    return result.success ? { toStore } : { problems: sectionProblems(result.error.issues, request) };
}
