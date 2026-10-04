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

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const env = envSchema.parse(environment);
  const dataDir = env.MYJOBBOT_DATA_DIR;
  const file = fileConfigSchema.parse(readConfigJson(dataDir));
  return { env, file, resume: readText(dataDir, "resume.md"), dataDir };
}

function readConfigJson(dataDir: string): unknown {
  const jsonPath = join(dataDir, "config.json");
  const yamlPath = join(dataDir, "config.yaml");
  if (!existsSync(jsonPath) && existsSync(yamlPath)) {
    throw new Error(`config is now JSON: convert ${yamlPath} to ${jsonPath}`);
  }
  return parseJson(readText(dataDir, "config.json"));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`config.json is not valid JSON: ${describeError(error)}`, { cause: error });
  }
}

function readText(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}
