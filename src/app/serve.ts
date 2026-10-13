import type { Server } from "node:http";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { JobViews } from "../db/jobViews.js";
import { openDatabase } from "../db/open.js";
import { buildClient } from "../web/clientBuild.js";
import { createUiServer, type UiState } from "../web/server.js";

/** Builds the browser app, then starts the web UI HTTP server, loading fresh config on each request. */
export async function startUi(environment: NodeJS.ProcessEnv): Promise<Server> {
  const { dataDir, env } = loadConfig(environment);
  const dbPath = join(dataDir, "myjobbot.db");
  const views = new JobViews(openDatabase(dbPath));
  const state = (): UiState => ({ config: loadConfig(environment).file, views, dbPath });
  const clientDir = await buildClient({ watch: environment.MYJOBBOT_WATCH === "1" });
  const server = createUiServer({ state, now: () => new Date(), clientDir });
  const { MYJOBBOT_HOST: host, MYJOBBOT_PORT: port } = env;
  server.listen(port, host, () => console.log(`myjobbot UI on http://${host}:${port}`));
  return server;
}
