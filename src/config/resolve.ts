import { OWNER_ID, type RawSearchSettings, type SearchSettingsStore } from "../db/searchSettingsStore.js";
import { fileConfigSchema, type FileConfig } from "./schema.js";
import { mergeSettings, sanitizeSearchSettings, settingNames, splitSettings, type FallbackNotice, type SplitSettings } from "./searchSettings.js";

export type SettingsNotice = { kind: "imported"; keys: string[] } | FallbackNotice | { kind: "file_ignored"; keys: string[] };

interface ResolvedSettings {
    file: FileConfig;
    notices: SettingsNotice[];
}

/** Resolves the settings a run or a page uses: the stored search settings, imported once from config.json when none are stored, joined with config.json's runtime settings and checked as a whole. */
export async function resolveSettings(fileRaw: unknown, store: SearchSettingsStore, at: string): Promise<ResolvedSettings> {
    const split = splitSettings(fileRaw);
    const stored = await store.load(OWNER_ID);
    if (stored !== null) return fromStored(split, stored);
    if (Object.keys(split.search).length === 0) return { file: fileConfigSchema.parse(split.runtime), notices: [] };
    return importFromFile(split, store, at);
}

/** Checks config.json's search settings as a whole and stores them once, using what another process stored if it got there first. */
async function importFromFile(split: SplitSettings, store: SearchSettingsStore, at: string): Promise<ResolvedSettings> {
    const file = fileConfigSchema.parse(mergeSettings(split.runtime, split.search));
    if (await store.importIfAbsent(split.search, at)) return { file, notices: [{ kind: "imported", keys: settingNames(split.search) }] };
    const stored = await store.load(OWNER_ID);
    if (stored === null) throw new Error("search settings could not be stored");
    return fromStored(split, stored);
}

/** Joins stored search settings, each bad one fallen back, with config.json's runtime settings, noting the fallbacks and any search settings the file still holds. */
function fromStored(split: SplitSettings, stored: RawSearchSettings): ResolvedSettings {
    const { settings } = sanitizeSearchSettings(stored);
    return { file: fileConfigSchema.parse(mergeSettings(split.runtime, settings)), notices: settingsNotices(split, stored) };
}

/** Lists what the stored search settings report: each value that fell back, and the search settings config.json still holds once some are stored. */
export function settingsNotices(split: SplitSettings, stored: RawSearchSettings | null): SettingsNotice[] {
    if (stored === null) return [];
    const ignored = settingNames(split.search);
    const fallbacks: SettingsNotice[] = sanitizeSearchSettings(stored).notices;
    return ignored.length > 0 ? [...fallbacks, { kind: "file_ignored", keys: ignored }] : fallbacks;
}
