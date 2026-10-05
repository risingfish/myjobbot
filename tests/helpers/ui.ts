import type { AddressInfo } from "node:net";
import { onTestFinished } from "vitest";
import type { JobViews } from "../../src/db/jobViews.js";
import { createUiServer, type UiState } from "../../src/web/server.js";
import { testFileConfig } from "./config.js";
import { TEST_NOW } from "./context.js";

export type UiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function startTestUi(views: JobViews, state: () => UiState = () => testState(views)): Promise<UiFetch> {
  const server = createUiServer({ state, now: () => TEST_NOW });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const { port } = server.address() as AddressInfo;
  return (path, init) => fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual", ...init });
}

export async function pageText(ui: UiFetch, path: string): Promise<string> {
  return (await ui(path)).text();
}

export function countRows(html: string, kind: "job" | "verdict"): number {
  return html.split(`<tr class="${kind}"`).length - 1;
}

function testState(views: JobViews): UiState {
  return { config: testFileConfig(), views, dbPath: "test.db" };
}
