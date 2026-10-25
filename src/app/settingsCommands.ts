import { readFileSync, writeFileSync } from "node:fs";
import { checkImport, exportDocument } from "../config/importSettings.js";
import { loadFileConfig } from "../config/load.js";
import { splitSettings } from "../config/searchSettings.js";
import { OWNER_ID, type SearchSettingsStore } from "../db/searchSettingsStore.js";

/** Writes the owner's stored search settings to a file in config.json's shape, for editing and importing back. */
export async function exportSettings(path: string, store: SearchSettingsStore): Promise<void> {
    writeFileSync(path, `${JSON.stringify(exportDocument(await store.load(OWNER_ID)), null, 2)}\n`);
}

/** Replaces the owner's stored search settings with a file's after checking it against config.json's runtime settings, returning every reason it was refused. */
export async function importSettings(path: string, dataDir: string, store: SearchSettingsStore): Promise<string[]> {
    const { runtime } = splitSettings(loadFileConfig(dataDir));
    const check = checkImport(readFileSync(path, "utf8"), path, runtime);
    if (!check.ok) return check.messages;
    await store.save(OWNER_ID, check.settings, new Date().toISOString());
    return [];
}
