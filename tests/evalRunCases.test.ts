import { expect, test } from "vitest";
import type { AssistantMessage } from "../src/agent/llm.js";
import type { Trace } from "../src/agent/trace.js";
import { EvalFiles } from "../src/evals/files.js";
import { runCases } from "../src/evals/runCases.js";
import { testAppConfig } from "./helpers/config.js";
import { answerKey, AT, evalCase, profile } from "./helpers/evalFixtures.js";
import { textReply, toolCallReply } from "./helpers/chat.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";
import { usageChat } from "./helpers/usageChat.js";

const RUN_ID = "20261103-180000-4000";
const scoring = (jobId: string, base: number): AssistantMessage[] => [toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: jobId, base, bonus: 30, reasons: [], gaps: [] }] })];
const silent = (): AssistantMessage[] => Array.from({ length: 8 }, () => textReply("hmm"));

function setup(scripts: AssistantMessage[][]) {
    const second = evalCase({ id: "lever-7", source: { ats: "lever", jobId: "7" }, tags: ["remote"], job: { job_id: "7", title: "Dev", days_open: 12, possible_ghost: false } });
    const files: Record<string, string> = { "evals/profiles/p1.json": JSON.stringify(profile()), "evals/cases/greenhouse-4012345.json": JSON.stringify(evalCase()), "evals/cases/lever-7.json": JSON.stringify(second), "evals/answer_keys/greenhouse-4012345.json": JSON.stringify(answerKey()) };
    const { port, files: stored, writes } = memoryFilePort(files);
    const lines: string[] = [];
    const queue = [...scripts];
    const makeChat = (log: Trace) => usageChat(queue.shift() ?? [], { prompt_tokens: 500, completion_tokens: 20 }).makeChat(log);
    const deps = { files: new EvalFiles(port), config: testAppConfig(), chatFor: () => makeChat, now: () => new Date(AT), random: () => 0.25, gitCommit: () => "abc123", print: (line: string) => void lines.push(line) };
    return { stored, writes, lines, run: (args: string[]) => runCases(args, deps) };
}

test("tags and case ids choose the cases, and a choice that matches none is refused", async () => {
    const { lines, run } = setup([scoring("7", 20)]);
    expect([await run(["--tag", "remote"]), await run(["--case", "nope"]), await run(["--repeats", "21"])]).toEqual([0, 1, 2]);
    expect([lines[0]?.replace(/\s+[\d.]+s$/, ""), lines.at(-2)]).toEqual(["[1/1] lever-7 #1  50  -  1.0k tok", "no cases to run"]);
});

test("each case is scored the run's number of times, a failed attempt doesn't stop the rest, and each is judged against its answer key", async () => {
    const { stored, lines, run } = setup([scoring("4012345", 45), silent(), scoring("7", 20), scoring("7", 25)]);
    expect(await run(["--repeats", "2"])).toBe(0);
    const results = (stored.get(`evals/runs/${RUN_ID}/results.jsonl`) ?? "")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { case: string; attempt: number; score: number | null; failure: string | null; passed: boolean | null });
    expect(results.map((result) => [result.case, result.attempt, result.score, result.failure, result.passed])).toEqual([
        ["greenhouse-4012345", 1, 75, null, true],
        ["greenhouse-4012345", 2, null, "no_record", false],
        ["lever-7", 1, 50, null, null],
        ["lever-7", 2, 55, null, null],
    ]);
    expect(lines.at(-1)).toMatch(/^run 20261103-180000-4000: 1\/2 passed · 1 failed attempt · [\d.]+k tokens · 0m0s$/);
});

test("the run's record is written before the first attempt and ended after the last, with one prompt per profile", async () => {
    const { stored, writes, run } = setup([scoring("4012345", 45), scoring("7", 20)]);
    await run([]);
    const runWrites = writes.filter((write) => write.includes(`runs/${RUN_ID}/`)).map((write) => write.split(" ")[0] + " " + (write.split("/").at(-1) ?? ""));
    const record = JSON.parse(stored.get(`evals/runs/${RUN_ID}/run.json`) ?? "{}") as { prompts: Record<string, string>; endedAt: string | null; cases: string[]; gitCommit: string; model: string };
    const prompt = JSON.parse(stored.get(`evals/prompts/${record.prompts.p1}.json`) ?? "{}") as { text: string };
    expect([Object.keys(record.prompts), record.endedAt, record.cases, record.gitCommit, prompt.text.includes("{open}"), prompt.text.includes("<<data")]).toEqual([["p1"], AT, ["greenhouse-4012345", "lever-7"], "abc123", true, false]);
    expect(runWrites.slice(0, 3)).toEqual(["write run.json.tmp", "rename run.json", "append results.jsonl"]);
    expect(runWrites.slice(-2)).toEqual(["write run.json.tmp", "rename run.json"]);
    expect(stored.get(`evals/runs/${RUN_ID}/trace.jsonl`)?.length).toBeGreaterThan(0);
});
