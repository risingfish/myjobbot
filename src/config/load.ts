import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJson } from "./parse.js";
import type { ProfileContent } from "../db/resumeStore.js";
import { envSchema, type Env, type Settings } from "./schema.js";

export type Environment = Readonly<Record<string, string | undefined>>;

export interface LoadedConfig {
    env: Env;
    fileRaw: unknown;
    resume: string | null;
    dataDir: string;
}

export interface AppConfig {
    env: Env;
    settings: Settings;
    resume: string;
    profile: ProfileContent | null;
    dataDir: string;
}

export type Owner = Pick<AppConfig, "resume" | "profile">;

/** Validates the environment and reads config.json and any resume file from the data folder, leaving config.json to be checked once the stored search settings are joined to it. */
export function loadConfig(environment: Environment): LoadedConfig {
    const env = envSchema.parse(environment);
    const dataDir = env.MYJOBBOT_DATA_DIR;
    return { env, fileRaw: loadFileConfig(dataDir), resume: readResumeFile(dataDir), dataDir };
}

/** Reads the data folder's resume.md, the resume used until one is uploaded, or null when there is none. */
export function readResumeFile(dataDir: string): string | null {
    return existsSync(join(dataDir, "resume.md")) ? readText(dataDir, "resume.md") : null;
}

/** Reads config.json from the data folder as raw JSON, for readers such as the web UI that join it to the stored search settings themselves. */
export function loadFileConfig(dataDir: string): unknown {
    return parseJson(readConfigText(dataDir), "config.json");
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
