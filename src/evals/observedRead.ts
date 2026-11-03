import type { FilePort } from "./filePort.js";

export type Read = "details" | "summary" | "unknown";

interface TraceLine {
    type?: unknown;
    job_id?: unknown;
    tool_calls?: Array<{ function?: { name?: unknown; arguments?: unknown } }>;
}

/** Finds the trace of the run or re-score that gave a verdict, as its lines, or null when it isn't kept. */
export async function traceOf(port: FilePort, runId: string | null): Promise<string[] | null> {
    if (runId === null) return null;
    const name = (await port.list("runs")).find((file) => file.endsWith(`-${runId}.jsonl`));
    const text = name === undefined ? null : await port.read(`runs/${name}`);
    return text === null ? null : text.split("\n");
}

/** Tells whether a trace's model read the job in full before scoring it, or only its summary, or that no trace is kept. */
export function observedRead(lines: string[] | null, jobId: string): Read {
    if (lines === null) return "unknown";
    const events = lines.flatMap(parsedLine);
    const rescore = events.some((event) => event.type === "rescore" && String(event.job_id) === jobId);
    const read = rescore ? (name: string) => name === "get_job" : (name: string, args: unknown) => name === "get_job_details" && jobIdOf(args) === jobId;
    return events.some((event) => (event.tool_calls ?? []).some((call) => read(String(call.function?.name), call.function?.arguments))) ? "details" : "summary";
}

/** Reads one trace line, skipping a line that isn't JSON. */
function parsedLine(line: string): TraceLine[] {
    try {
        const value: unknown = JSON.parse(line);
        return typeof value === "object" && value !== null ? [value as TraceLine] : [];
    } catch {
        return [];
    }
}

/** Takes the job id a tool call names, as text whether the model sent it as text or a number. */
function jobIdOf(args: unknown): string | null {
    const parsed = typeof args === "string" ? parsedLine(args)[0] : undefined;
    return parsed?.job_id === undefined ? null : String(parsed.job_id);
}
