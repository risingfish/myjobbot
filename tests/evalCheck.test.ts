import { expect, test } from "vitest";
import { checkEvals } from "../src/evals/check.js";
import { EvalFiles } from "../src/evals/files.js";
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
    expect(await checkEvals(new EvalFiles(port))).toEqual({ lines: ["profiles 1 · cases 1 · answer keys 1 · prompts 1 · runs 1"], code: 0 });
});

test("check names bad files, answer keys without a case and cases without a profile, and exits 1", async () => {
    const { port } = memoryFilePort({
        "evals/cases/greenhouse-4012345.json": json(evalCase()),
        "evals/cases/lever-1.json": "{",
        "evals/answer_keys/lever-9.json": json(answerKey()),
        "evals/runs/20261103-180000-3f2a/run.json": json(run()),
        "evals/runs/20261103-180000-3f2a/results.jsonl": "{\n",
    });
    expect(await checkEvals(new EvalFiles(port))).toEqual({
        lines: ["profiles 0 · cases 1 · answer keys 1 · prompts 0 · runs 1", "bad: cases/lever-1.json: not valid JSON", "bad: runs/20261103-180000-3f2a/results.jsonl:1: not valid JSON", "bad: answer_keys/lever-9.json: orphaned (no case)", "bad: cases/greenhouse-4012345.json: orphaned (no profile p1)"],
        code: 1,
    });
});
