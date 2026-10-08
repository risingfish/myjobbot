import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describeError } from "../errors.js";
import { envSchema, fileConfigSchema, type Env, type FileConfig } from "./schema.js";

export interface AppConfig {
  env: Env;
  file: FileConfig;
  resume: string;
  dataDir: string;
}

/** Loads and validates the environment and on-disk config, returning the app's combined configuration. */
export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const env = envSchema.parse(environment);
  const dataDir = env.MYJOBBOT_DATA_DIR;
  const file = fileConfigSchema.parse(readConfigJson(dataDir));
  requireSearchKey(env, file);
  return { env, file, resume: readText(dataDir, "resume.md"), dataDir };
}

/** Ensures a JSearch API key is configured whenever saved searches need it to run. */
function requireSearchKey(env: Env, file: FileConfig): void {
  if (file.searches.length > 0 && !env.JSEARCH_API_KEY) {
    throw new Error("JSEARCH_API_KEY is required when searches are configured");
  }
}

/** Reads and parses the JSON config file, rejecting a legacy YAML config with a migration hint. */
function readConfigJson(dataDir: string): unknown {
  const jsonPath = join(dataDir, "config.json");
  const yamlPath = join(dataDir, "config.yaml");
  if (!existsSync(jsonPath) && existsSync(yamlPath)) {
    throw new Error(`config is now JSON: convert ${yamlPath} to ${jsonPath}`);
  }
  return parseJson(readText(dataDir, "config.json"));
}

/** Parses JSON text, wrapping any parse error with a clearer, config-specific message. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`config.json is not valid JSON: ${describeError(error)}`, { cause: error });
  }
}

/** Reads a text file from the configured data directory. */
function readText(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}
