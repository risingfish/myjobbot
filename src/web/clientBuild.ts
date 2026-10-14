import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { describeError } from "../errors.js";
import { viteConfig } from "./viteConfig.js";

type BuildResult = Awaited<ReturnType<typeof build>>;
type Watcher = Extract<BuildResult, { on: unknown }>;

/** Builds the browser app into a new private folder outside the project, rebuilding on change when watching, and returns that folder. */
export async function buildClient(options: { watch: boolean; outDir?: string }): Promise<string> {
  const outDir = options.outDir ?? mkdtempSync(join(tmpdir(), "myjobbot-client-"));
  const settings = { ...viteConfig.build, outDir, watch: options.watch ? {} : null };
  const result = await build({ ...viteConfig, configFile: false, build: settings });
  if ("on" in result) await firstBuild(result);
  return outDir;
}

/** Waits for a watching build's first pass, logging a failure rather than stopping the server. */
function firstBuild(watcher: Watcher): Promise<void> {
  return new Promise((resolve) => {
    watcher.on("event", (event) => {
      if (event.code === "ERROR") console.error(`myjobbot: client build failed: ${describeError(event.error)}`);
      if (event.code === "END" || event.code === "ERROR") resolve();
    });
  });
}
