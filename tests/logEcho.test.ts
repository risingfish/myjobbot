import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { lineTrace } from "../src/agent/trace.js";
import { openRunLogs } from "../src/app/runLogs.js";
import { envSchema } from "../src/config/schema.js";

const LLM_ENV = { LLM_BASE_URL: "http://localhost:1234/v1", LLM_MODEL: "m", LLM_API_KEY: "k" };

function loaded(echo: string | undefined) {
    const root = mkdtempSync(join(tmpdir(), "myjobbot-logs-"));
    const env = envSchema.parse({ ...LLM_ENV, MYJOBBOT_LOG_DIR: join(root, "log"), ...(echo === undefined ? {} : { MYJOBBOT_LOG_STDOUT: echo }) });
    return { root, config: { env, fileRaw: {}, resume: null, dataDir: root } };
}

test("a line trace prints each event as one JSON line, stamped with the time, the run and its stream", () => {
    const lines: string[] = [];
    lineTrace((line) => void lines.push(line), "trace", "run-1").write({ type: "start" });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ stream: "trace", run_id: "run-1", type: "start", at: expect.any(String) });
});

test("with MYJOBBOT_LOG_STDOUT=1 a run's trace and job log are echoed to stdout as well as written to their files, and the model log is not echoed", () => {
    const lines: string[] = [];
    const { root, config } = loaded("1");
    const logs = openRunLogs(config, { write: (line) => void lines.push(line), isTTY: false });
    logs.trace.write({ type: "a" });
    logs.jobs.write({ type: "b" });
    logs.llm.write({ type: "c" });
    expect(lines.map((line) => (JSON.parse(line) as { stream: string }).stream)).toEqual(["trace", "jobs"]);
    expect([readdirSync(join(root, "runs")).length, readdirSync(join(root, "log")).length]).toEqual([1, 2]);
});

test("without MYJOBBOT_LOG_STDOUT nothing is echoed", () => {
    const lines: string[] = [];
    const logs = openRunLogs(loaded(undefined).config, { write: (line) => void lines.push(line), isTTY: false });
    logs.trace.write({ type: "a" });
    logs.jobs.write({ type: "b" });
    expect(lines).toEqual([]);
});

test("a command typed at a terminal isn't echoed even with MYJOBBOT_LOG_STDOUT=1, so its own output stays readable", () => {
    const lines: string[] = [];
    const logs = openRunLogs(loaded("1").config, { write: (line) => void lines.push(line), isTTY: true });
    logs.trace.write({ type: "a" });
    logs.jobs.write({ type: "b" });
    expect(lines).toEqual([]);
});
