import type { Trace } from "../agent/trace.js";
import type { AppConfig, LoadedConfig } from "../config/load.js";
import { appConfigFrom } from "../config/parse.js";
import { resolveSettings } from "../config/resolve.js";
import { ownsResumeFile } from "../config/resumeFile.js";
import type { UserResumeStore } from "../db/resumeStore.js";
import type { UserSearchSettingsStore } from "../db/searchSettingsStore.js";

export interface RunSettingsStores {
    userId: number;
    searchSettings: UserSearchSettingsStore;
    resume: UserResumeStore;
}

const NO_RESUME = "No resume: upload one on the Settings page";

/** Resolves a run's settings, resume and profile once at its start, tracing what resolving the settings reported, so the run keeps them throughout. */
export async function settingsForRun(loaded: LoadedConfig, stores: RunSettingsStores, trace: Trace): Promise<AppConfig> {
    const { settings, notices } = await resolveSettings(loaded.fileRaw, stores.searchSettings);
    for (const { kind, ...fields } of notices) trace.write({ type: `settings_${kind}`, ...fields });
    const [resume, profile] = await Promise.all([resumeInUse(loaded, stores), stores.resume.profile()]);
    return appConfigFrom(loaded, settings, { resume, profile: profile === null ? null : { summary: profile.summary, skills: profile.skills } });
}

/** Gives the resume a run scores against: the user's uploaded one, else, for the owner only, the data folder's file, refusing the run when there is neither. */
async function resumeInUse(loaded: LoadedConfig, stores: RunSettingsStores): Promise<string> {
    const resume = (await stores.resume.currentResume())?.text ?? (ownsResumeFile(stores.userId) ? loaded.resume : null);
    if (resume === null) throw new Error(NO_RESUME);
    return resume;
}
