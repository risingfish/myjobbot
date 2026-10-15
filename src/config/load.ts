import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appConfigFrom, parseFileConfig } from "./parse.js";
import { envSchema, type Env, type FileConfig } from "./schema.js";

export type Environment = Readonly<Record<string, string | undefined>>;

export interface AppConfig {
    env: Env;
    file: FileConfig;
    resume: string;
    dataDir: string;
}

/** Loads and validates the environment and on-disk config, returning the app's combined configuration. */
export function loadConfig(environment: Environment): AppConfig {
    const dataDir = envSchema.parse(environment).MYJOBBOT_DATA_DIR;
    return appConfigFrom(environment, { configText: readConfigText(dataDir), resume: readText(dataDir, "resume.md"), dataDir });
}

/** Loads and validates only the on-disk config, for readers such as the web UI that need no agent settings. */
export function loadFileConfig(dataDir: string): FileConfig {
    return parseFileConfig(readConfigText(dataDir));
}

/** Reads the JSON config file's text, rejecting a legacy YAML config with a migration hint. */
function readConfigText(dataDir: string): string {
    const jsonPath = join(dataDir, "config.json");
    const yamlPath = join(dataDir, "config.yaml");
    if (!existsSync(jsonPath) && existsSync(yamlPath)) {
        throw new Error(`config is now JSON: convert ${yamlPath} to ${jsonPath}`);
    }
    return readText(dataDir, "config.json");
}

/** Reads a text file from the configured data directory. */
function readText(dir: string, name: string): string {
    return readFileSync(join(dir, name), "utf8");
}
