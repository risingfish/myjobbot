import { OWNER_ID, type RawSearchSettings, type SearchSettingsStore } from "../db/searchSettingsStore.js";
import { fileConfigSchema, type FileConfig } from "./schema.js";
import { mergeSettings, retiredKeys, sanitizeSearchSettings, settingNames, splitSettings, type FallbackNotice, type SplitSettings } from "./searchSettings.js";

export type SettingsNotice = FallbackNotice | { kind: "file_ignored"; keys: string[] } | { kind: "retired"; keys: string[] };

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

/** Lists what the search settings report: each stored value that fell back, the search settings config.json still holds, which are never used, and the boards and searches left behind by the move to saved sources. */
export function settingsNotices(split: SplitSettings, stored: RawSearchSettings | null): SettingsNotice[] {
    const ignored = settingNames(split.search);
    const retired = retiredKeys(split, stored);
    const notices: SettingsNotice[] = stored === null ? [] : sanitizeSearchSettings(stored).notices;
    if (ignored.length > 0) notices.push({ kind: "file_ignored", keys: ignored });
    if (retired.length > 0) notices.push({ kind: "retired", keys: retired });
    return notices;
}
