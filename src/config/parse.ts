import { describeError } from "../errors.js";
import type { AppConfig, LoadedConfig } from "./load.js";
import type { Env, FileConfig } from "./schema.js";

/** Builds the app's configuration from the loaded environment, resume and data folder and the resolved config.json settings. */
export function appConfigFrom(loaded: LoadedConfig, file: FileConfig): AppConfig {
    requireSearchKey(loaded.env, file);
    return { env: loaded.env, file, resume: loaded.resume, dataDir: loaded.dataDir };
}

/** Ensures a JSearch API key is configured whenever saved searches need it to run. */
function requireSearchKey(env: Env, file: FileConfig): void {
    if (file.searches.length > 0 && !env.JSEARCH_API_KEY) {
        throw new Error("JSEARCH_API_KEY is required when searches are configured");
    }
}

/** Parses JSON text, wrapping any parse error with a message naming the file it came from. */
export function parseJson(text: string, name: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`${name} is not valid JSON: ${describeError(error)}`, { cause: error });
    }
}
