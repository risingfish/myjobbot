import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileTrace, type Trace } from "../agent/trace.js";
import type { LoadedConfig } from "../config/load.js";

export interface RunLogs {
    runId: string;
    trace: Trace;
    llm: Trace;
    jobs: Trace;
}

/** Opens the trace, LLM, and job JSONL log files used to record one run. */
export function openRunLogs(config: LoadedConfig): RunLogs {
    const runId = randomUUID();
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${runId}`;
    const logDir = config.env.MYJOBBOT_LOG_DIR;
    return {
        runId,
        trace: openJsonl(join(config.dataDir, "runs"), `${name}.jsonl`, runId),
        llm: openJsonl(logDir, `${name}.llm.jsonl`, runId),
        jobs: openJsonl(logDir, `${name}.jobs.jsonl`, runId),
    };
}

/** Creates a file-backed Trace, creating its parent directory first if needed. */
function openJsonl(dir: string, file: string, runId: string): Trace {
    mkdirSync(dir, { recursive: true });
    return fileTrace(join(dir, file), runId);
}
