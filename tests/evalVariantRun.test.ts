import { expect, test } from "vitest";
import type { AssistantMessage } from "../src/agent/llm.js";
import type { Trace } from "../src/agent/trace.js";
import { ExperimentFiles } from "../src/evals/experimentFiles.js";
import { EvalFiles } from "../src/evals/files.js";
import { runCases } from "../src/evals/runCases.js";
import { codeTemplateId, formatVariant } from "../src/evals/variant.js";
import { rescoreSystemTemplate } from "../src/rescore/prompt.js";
import { testAppConfig } from "./helpers/config.js";
import { toolCallReply } from "./helpers/chat.js";
import { AT, evalCase, profile } from "./helpers/evalFixtures.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";
import { usageChat } from "./helpers/usageChat.js";

const EDITED = rescoreSystemTemplate().replace("Scoring rules:", "Scoring rules (be strict about level):");
const scoring = (): AssistantMessage[] => [toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: "4012345", base: 40, bonus: 30, reasons: [], gaps: [] }] })];
const variantFile = (text: string, exportedFrom = codeTemplateId()) => formatVariant({ header: { schema: 1, exportedAt: AT, exportedFrom, gitCommit: null }, text });

function setup(variants: Record<string, string>) {
    const seed: Record<string, string> = { "evals/profiles/p1.json": JSON.stringify(profile()), "evals/cases/greenhouse-4012345.json": JSON.stringify(evalCase()) };
    for (const [name, text] of Object.entries(variants)) seed[`evals/variants/${name}.md`] = text;
    const { port, files } = memoryFilePort(seed);
    const lines: string[] = [];
    const systems: string[] = [];
    const makeChat = (log: Trace) => {
        const chat = usageChat(scoring()).makeChat(log);
        return async (...args: Parameters<typeof chat>) => (systems.push(String(args[0][0]?.content)), chat(...args));
    };
    const deps = { files: new EvalFiles(port), experiments: new ExperimentFiles(port), config: testAppConfig(), chatFor: () => makeChat, now: () => new Date(AT), random: () => 0.25, gitCommit: () => null, print: (line: string) => void lines.push(line) };
    const runRecord = () => JSON.parse(files.get("evals/runs/20261103-180000-4000/run.json") ?? "{}") as { variant?: string | null; promptChanged?: boolean; prompts: Record<string, string> };
    return { files, lines, systems, runRecord, run: (args: string[]) => runCases(args, deps) };
}

test("a run with a variant scores with the variant's wording and records the variant", async () => {
    const { systems, runRecord, run, files } = setup({ strict: variantFile(EDITED) });
    expect(await run(["--variant", "strict"])).toBe(0);
    const record = runRecord();
    const prompt = JSON.parse(files.get(`evals/prompts/${record.prompts.p1}.json`) ?? "{}") as { text: string };
    expect([systems[0]?.includes("be strict about level"), prompt.text.includes("be strict about level"), record.variant, record.promptChanged]).toEqual([true, true, "strict", false]);
});

test("a variant exported before the code's prompt changed still runs, with a warning, and the run says so", async () => {
    const { lines, runRecord, run } = setup({ old: variantFile(EDITED, "0000000000000000") });
    expect([await run(["--variant", "old"]), lines[0], runRecord().promptChanged]).toEqual([0, "warning: the code's prompt has changed since old was exported", true]);
});

test("a variant that drops the data sentence or holds a marker the run doesn't fill is refused before any model call", async () => {
    const { lines, systems, run, files } = setup({ unsafe: variantFile(EDITED.replace("{data}", "").replace("{threshold}", "{thresold}")) });
    expect([await run(["--variant", "unsafe"]), lines, systems.length, files.has("evals/runs/20261103-180000-4000/run.json")]).toEqual([1, ["refused variant unsafe: missing {data}, missing {threshold}, unknown marker {thresold}"], 0, false]);
});

test("a variant that doesn't exist, or a name that can't be one, is refused the same way", async () => {
    const { lines, systems, run } = setup({});
    expect([await run(["--variant", "nope"]), await run(["--variant", "Not/Ok"]), lines, systems.length]).toEqual([1, 1, ["refused variant nope: no such variant", "refused variant Not/Ok: variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40"], 0]);
});
