import type { FileConfig } from "../config/schema.js";

interface RunState {
  finished: boolean;
  summary: string | null;
}

export interface ToolContext {
  config: FileConfig;
  run: RunState;
}

export function newRunState(): RunState {
  return { finished: false, summary: null };
}
