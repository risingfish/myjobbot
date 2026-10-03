import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
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
  const file = fileConfigSchema.parse(parse(readText(dataDir, "config.yaml")));
  return { env, file, resume: readText(dataDir, "resume.md"), dataDir };
}

function readText(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}
