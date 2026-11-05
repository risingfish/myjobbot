import type { Trace } from "../agent/trace.js";
import type { AppConfig, LoadedConfig } from "../config/load.js";
import { appConfigFrom } from "../config/parse.js";
import { resolveSettings } from "../config/resolve.js";
import type { ResumeStore } from "../db/resumeStore.js";
import { OWNER_ID, type SearchSettingsStore } from "../db/searchSettingsStore.js";

export interface RunSettingsStores {
    searchSettings: SearchSettingsStore;
    resume: ResumeStore;
}

const NO_RESUME = "No resume: upload one on the Settings page";

/** Resolves a run's settings, resume and profile once at its start, tracing what resolving the settings reported, so the run keeps them throughout. */
export async function settingsForRun(loaded: LoadedConfig, stores: RunSettingsStores, trace: Trace): Promise<AppConfig> {
    const { settings, notices } = await resolveSettings(loaded.fileRaw, stores.searchSettings);
    for (const { kind, ...fields } of notices) trace.write({ type: `settings_${kind}`, ...fields });
    const [resume, profile] = await Promise.all([resumeInUse(loaded, stores.resume), stores.resume.profile(OWNER_ID)]);
    return appConfigFrom(loaded, settings, { resume, profile: profile === null ? null : { summary: profile.summary, skills: profile.skills } });
}

/** Gives the resume a run scores against: the uploaded one, else the data folder's file, refusing the run when there is neither. */
async function resumeInUse(loaded: LoadedConfig, store: ResumeStore): Promise<string> {
    const resume = (await store.currentResume(OWNER_ID))?.text ?? loaded.resume;
    if (resume === null) throw new Error(NO_RESUME);
    return resume;
}
