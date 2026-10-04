import type { Trace } from "../agent/trace.js";
import type { FileConfig } from "../config/schema.js";
import type { ApiCallLog } from "../db/apiCalls.js";
import type { JobStore } from "../db/jobStore.js";
import type { JsonGetter } from "../http/client.js";
import type { FetchOutcome } from "./sources.js";

interface RunState {
  finished: boolean;
  summary: string | null;
  fetches: Map<string, Promise<FetchOutcome>>;
  failedFetches: Set<string>;
}

export interface ToolContext {
  config: FileConfig;
  run: RunState;
  store: JobStore;
  apiCalls: ApiCallLog;
  http: JsonGetter;
  now: () => Date;
  jobLog: Trace;
  jsearchApiKey: string | null;
}

export function newRunState(): RunState {
  return { finished: false, summary: null, fetches: new Map(), failedFetches: new Set() };
}
