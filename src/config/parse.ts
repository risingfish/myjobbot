import { describeError } from "../errors.js";
import type { AppConfig, LoadedConfig, Owner } from "./load.js";
import type { Settings } from "./schema.js";

/** Builds the app's configuration from the loaded environment and data folder, the resolved settings, and the resume and profile in use. */
export function appConfigFrom(loaded: LoadedConfig, settings: Settings, owner: Owner): AppConfig {
    return { env: loaded.env, settings, resume: owner.resume, profile: owner.profile, dataDir: loaded.dataDir };
}

/** Parses JSON text, wrapping any parse error with a message naming the file it came from. */
export function parseJson(text: string, name: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${name} is not valid JSON: ${describeError(error)}`, { cause: error });
    }
}
