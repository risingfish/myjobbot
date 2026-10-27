import type { Trace } from "../agent/trace.js";
import type { AppConfig, LoadedConfig } from "../config/load.js";
import { appConfigFrom } from "../config/parse.js";
import { resolveSettings } from "../config/resolve.js";
import type { SearchSettingsStore } from "../db/searchSettingsStore.js";

/** Resolves a run's settings once at its start, tracing what resolving them reported, so the run keeps the same settings throughout. */
export async function settingsForRun(loaded: LoadedConfig, store: SearchSettingsStore, trace: Trace): Promise<AppConfig> {
    const { file, notices } = await resolveSettings(loaded.fileRaw, store);
    for (const { kind, ...fields } of notices) trace.write({ type: `settings_${kind}`, ...fields });
    return appConfigFrom(loaded, file);
}
