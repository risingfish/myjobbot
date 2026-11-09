import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileTrace, lineTrace, teeTrace, type Trace } from "../agent/trace.js";
import type { LoadedConfig } from "../config/load.js";

export interface RunLogs {
    runId: string;
    trace: Trace;
    llm: Trace;
    jobs: Trace;
}

type Stream = Exclude<keyof RunLogs, "runId">;

// The model log is left out: it holds every model response with the job text, and would swamp the container's log.
const ECHOED: Record<Stream, boolean> = { trace: true, jobs: true, llm: false };

/** Opens the trace, LLM, and job JSONL log files used to record one run, echoing the trace and job log to stdout as well when MYJOBBOT_LOG_STDOUT is 1. */
export function openRunLogs(config: LoadedConfig, echo: (line: string) => void = (line) => void process.stdout.write(line)): RunLogs {
    const runId = randomUUID();
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${runId}`;
    const logDir = config.env.MYJOBBOT_LOG_DIR;
    const echoed = (stream: Stream, file: Trace) => (config.env.MYJOBBOT_LOG_STDOUT === "1" && ECHOED[stream] ? teeTrace(file, lineTrace(echo, stream, runId)) : file);
    return {
        runId,
        trace: echoed("trace", openJsonl(join(config.dataDir, "runs"), `${name}.jsonl`, runId)),
        llm: echoed("llm", openJsonl(logDir, `${name}.llm.jsonl`, runId)),
        jobs: echoed("jobs", openJsonl(logDir, `${name}.jobs.jsonl`, runId)),
    };
}

/** Creates a file-backed Trace, creating its parent directory first if needed. */
function openJsonl(dir: string, file: string, runId: string): Trace {
    mkdirSync(dir, { recursive: true });
    return fileTrace(join(dir, file), runId);
}
