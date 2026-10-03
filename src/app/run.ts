import { loadConfig } from "../config/load.js";

export async function runOnce(environment: NodeJS.ProcessEnv): Promise<string> {
  const config = loadConfig(environment);
  return `loaded ${config.file.companies.length} companies`;
}
