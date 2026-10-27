import { OWNER_ID, type RawSearchSettings, type SearchSettingsStore } from "../db/searchSettingsStore.js";
import { fileConfigSchema, type FileConfig } from "./schema.js";
import { mergeSettings, sanitizeSearchSettings, settingNames, splitSettings, type FallbackNotice, type SplitSettings } from "./searchSettings.js";

export type SettingsNotice = FallbackNotice | { kind: "file_ignored"; keys: string[] };

interface ResolvedSettings {
    file: FileConfig;
    notices: SettingsNotice[];
}

/** Resolves the settings a run or a page uses: the stored search settings, each bad one fallen back, joined with config.json's runtime settings and checked as a whole; search settings left in config.json are never used. */
export async function resolveSettings(fileRaw: unknown, store: SearchSettingsStore): Promise<ResolvedSettings> {
    const split = splitSettings(fileRaw);
    const stored = await store.load(OWNER_ID);
    const { settings } = sanitizeSearchSettings(stored ?? {});
    return { file: fileConfigSchema.parse(mergeSettings(split.runtime, settings)), notices: settingsNotices(split, stored) };
}

/** Lists what the search settings report: each stored value that fell back, and the search settings config.json still holds, which are never used. */
export function settingsNotices(split: SplitSettings, stored: RawSearchSettings | null): SettingsNotice[] {
    const ignored = settingNames(split.search);
    const fallbacks: SettingsNotice[] = stored === null ? [] : sanitizeSearchSettings(stored).notices;
    return ignored.length > 0 ? [...fallbacks, { kind: "file_ignored", keys: ignored }] : fallbacks;
}
