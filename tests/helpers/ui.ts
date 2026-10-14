import type { AddressInfo } from "node:net";
import { onTestFinished } from "vitest";
import type { JobViews } from "../../src/db/jobViews.js";
import { createUiServer, type UiState } from "../../src/web/server.js";
import { makeClientDir } from "./clientDir.js";
import { testFileConfig } from "./config.js";
import { TEST_NOW } from "./context.js";

export type UiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function startTestUi(views: JobViews, state: () => UiState = () => testState(views), clientDir = makeClientDir()): Promise<UiFetch> {
  const server = createUiServer({ state, now: () => TEST_NOW, clientDir });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const { port } = server.address() as AddressInfo;
  return (path, init) => fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual", ...init });
}

function testState(views: JobViews): UiState {
  return { config: testFileConfig(), views, dbPath: "test.db" };
}
