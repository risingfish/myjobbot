import type { FileConfig } from "../config/schema.js";
import type { JobStore } from "../db/jobStore.js";
import type { JsonGetter } from "../http/client.js";

interface RunState {
  finished: boolean;
  summary: string | null;
  fetches: Map<string, Promise<string>>;
  failedFetches: Set<string>;
}

export interface ToolContext {
  config: FileConfig;
  run: RunState;
  store: JobStore;
  http: JsonGetter;
  now: () => Date;
}

export function newRunState(): RunState {
  return { finished: false, summary: null, fetches: new Map(), failedFetches: new Set() };
}
