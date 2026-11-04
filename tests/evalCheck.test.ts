import { expect, test } from "vitest";
import { checkEvals } from "../src/evals/check.js";
import { EvalFiles } from "../src/evals/files.js";
import { ExperimentFiles } from "../src/evals/experimentFiles.js";
import { formatVariant } from "../src/evals/variant.js";
import { rescoreSystemTemplate } from "../src/rescore/prompt.js";
import { answerKey, evalCase, profile, result, run } from "./helpers/evalFixtures.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";

const json = (value: unknown) => JSON.stringify(value);

test("check counts each kind and exits 0 when every file is good", async () => {
    const { port } = memoryFilePort({
        "evals/profiles/p1.json": json(profile()),
        "evals/cases/greenhouse-4012345.json": json(evalCase()),
        "evals/answer_keys/greenhouse-4012345.json": json(answerKey()),
        "evals/prompts/prompt1.json": json({ schema: 1, text: "rubric" }),
        "evals/runs/20261103-180000-3f2a/run.json": json(run()),
        "evals/runs/20261103-180000-3f2a/results.jsonl": `${json(result())}\n`,
    });
    expect(await checkEvals(new EvalFiles(port), new ExperimentFiles(port))).toEqual({ lines: ["profiles 1 · cases 1 · answer keys 1 · prompts 1 · runs 1 · variants 0 · series 0 · series runs 0"], code: 0 });
});

test("check names bad files, answer keys whose case is missing or bad and cases without a profile, and exits 1", async () => {
    const { port } = memoryFilePort({
        "evals/cases/greenhouse-4012345.json": json(evalCase()),
        "evals/cases/lever-1.json": "{",
        "evals/answer_keys/lever-9.json": json(answerKey()),
        "evals/answer_keys/lever-1.json": json(answerKey()),
        "evals/runs/20261103-180000-3f2a/run.json": json(run()),
        "evals/runs/20261103-180000-3f2a/results.jsonl": "{\n",
    });
    expect(await checkEvals(new EvalFiles(port), new ExperimentFiles(port))).toEqual({
        lines: ["profiles 0 · cases 1 · answer keys 2 · prompts 0 · runs 1 · variants 0 · series 0 · series runs 0", "bad: cases/lever-1.json: not valid JSON", "bad: runs/20261103-180000-3f2a/results.jsonl:1: not valid JSON", "bad: answer_keys/lever-1.json: orphaned (case is bad)", "bad: answer_keys/lever-9.json: orphaned (no case)", "bad: cases/greenhouse-4012345.json: orphaned (no profile p1)"],
        code: 1,
    });
});

test("check counts variants, series and series runs, names a variant that doesn't read as one, and lists a variant that can't be run", async () => {
    const header = { schema: 1 as const, exportedAt: "2026-11-04T18:00:00.000Z", exportedFrom: "0123456789abcdef", gitCommit: null };
    const { port } = memoryFilePort({
        "evals/variants/good.md": formatVariant({ header, text: rescoreSystemTemplate() }),
        "evals/variants/unsafe.md": formatVariant({ header, text: "no markers here {threshold} {preferences}" }),
        "evals/variants/broken.md": "no header at all",
        "evals/series/try.json": json({ schema: 1, tags: ["smoke"], cases: [], repeats: 2, tests: [{ label: "now", variant: null, model: null }], createdAt: "2026-11-04T18:00:00.000Z" }),
    });
    expect(await checkEvals(new EvalFiles(port), new ExperimentFiles(port))).toEqual({
        lines: ["profiles 0 · cases 0 · answer keys 0 · prompts 0 · runs 0 · variants 2 · series 1 · series runs 0", "bad: variants/broken.md: no closing --- after the header", "bad: variants/unsafe.md: missing {data}"],
        code: 1,
    });
});
