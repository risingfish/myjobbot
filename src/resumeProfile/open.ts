import { createChat } from "../agent/llm.js";
import { dataMarkers } from "../agent/markers.js";
import { openRunLogs } from "../app/runLogs.js";
import { settingsForRun } from "../app/runSettings.js";
import { loadConfig, type Environment } from "../config/load.js";
import type { Resume } from "../db/resumeStore.js";
import type { UserStores } from "../db/userStores.js";
import { extractProfile, type Extracted } from "./extract.js";
import { usageOnlyLog } from "./usageLog.js";

/** Extracts a profile from a resume as a run would: its own trace in the data folder, the model client with a usage-only response log, and its own markers. */
export async function extractWithModel(environment: Environment, stores: UserStores, resume: Pick<Resume, "text">): Promise<Extracted> {
    const loaded = loadConfig(environment);
    const logs = openRunLogs(loaded);
    const config = await settingsForRun(loaded, stores, logs.trace);
    const chat = createChat(config.env, usageOnlyLog(logs.llm));
    logs.trace.write({ type: "resume_profile" });
    return extractProfile(resume, { chat, trace: logs.trace, markers: dataMarkers(logs.runId), limits: config.settings.agent });
}
