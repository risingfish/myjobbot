import type { Server } from "node:http";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { JobViews } from "../db/jobViews.js";
import { openDatabase } from "../db/open.js";
import { createUiServer, type UiState } from "../web/server.js";

export function startUi(environment: NodeJS.ProcessEnv): Server {
  const { dataDir, env } = loadConfig(environment);
  const dbPath = join(dataDir, "myjobbot.db");
  const views = new JobViews(openDatabase(dbPath));
  const state = (): UiState => ({ config: loadConfig(environment).file, views, dbPath });
  const server = createUiServer({ state, now: () => new Date() });
  const { MYJOBBOT_HOST: host, MYJOBBOT_PORT: port } = env;
  server.listen(port, host, () => console.log(`myjobbot UI on http://${host}:${port}`));
  return server;
}
