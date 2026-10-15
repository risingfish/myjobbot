import { describeError } from "../errors.js";
import type { AppConfig, Environment } from "./load.js";
import { envSchema, fileConfigSchema, type Env, type FileConfig } from "./schema.js";

/** Builds the app's configuration from the environment and the already-read config and resume files. */
export function appConfigFrom(environment: Environment, files: { configText: string; resume: string; dataDir: string }): AppConfig {
    const env = envSchema.parse(environment);
    const file = parseFileConfig(files.configText);
    requireSearchKey(env, file);
    return { env, file, resume: files.resume, dataDir: files.dataDir };
}

/** Parses and validates config.json's text, explaining invalid JSON readably. */
export function parseFileConfig(text: string): FileConfig {
    return fileConfigSchema.parse(parseJson(text));
}

/** Ensures a JSearch API key is configured whenever saved searches need it to run. */
function requireSearchKey(env: Env, file: FileConfig): void {
    if (file.searches.length > 0 && !env.JSEARCH_API_KEY) {
        throw new Error("JSEARCH_API_KEY is required when searches are configured");
    }
}

/** Parses JSON text, wrapping any parse error with a clearer, config-specific message. */
function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`config.json is not valid JSON: ${describeError(error)}`, { cause: error });
    }
}
