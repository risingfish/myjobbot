import { loadFileConfig } from "../../src/config/load.js";
import { gmailSettings, sourceSettings } from "../../src/config/runtimeParts.js";
import type { Settings } from "../../src/config/schema.js";
import { splitSettings } from "../../src/config/searchSettings.js";

/** Returns the data folder the web UI reads its config from, from MYJOBBOT_DATA_DIR. */
export function dataDir(): string {
    return process.env.MYJOBBOT_DATA_DIR ?? "data";
}

/** Returns config.json's HTTP settings and JSearch budget and schedule, which saving and testing sources use. */
export function sourceConfig(): Pick<Settings, "http" | "jsearch"> {
    return sourceSettings(loadFileConfig(dataDir()));
}

/** Returns config.json's runtime settings, the part a search settings save is checked against. */
export function runtimeSettings(): unknown {
    return splitSettings(loadFileConfig(dataDir())).runtime;
}

/** Returns the senders whose mail counts as a job alert, from config.json's runtime settings alone. */
export function alertSenders(): string[] {
    return gmailSettings(loadFileConfig(dataDir())).alert_senders;
}
