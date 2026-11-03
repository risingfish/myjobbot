import { expect, test } from "vitest";
import { EvalFiles } from "../src/evals/files.js";
import { answerKey, evalCase, profile, result, run } from "./helpers/evalFixtures.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";

const json = (value: unknown) => JSON.stringify(value);

const SEEDED = {
    "evals/profiles/p1.json": json(profile()),
    "evals/cases/greenhouse-4012345.json": json(evalCase()),
    "evals/cases/lever-1.json": "{ secret job text",
    "evals/cases/lever-2.json": json(evalCase({ id: "lever-2", job: { job_id: "2", title: "secret title", days_open: "twelve", possible_ghost: false } })),
    "evals/cases/lever-3.json": json(evalCase({ id: "lever-3", schema: 2 })),
    "evals/cases/lever-4.json": json(evalCase({ id: "lever-9" })),
    "evals/cases/lever-5.json.tmp": "half written",
    "evals/answer_keys/greenhouse-4012345.json": json(answerKey()),
    "evals/prompts/prompt1.json": json({ schema: 1, text: "rubric" }),
};

test("each kind is read with its good files kept and every bad one named with a problem that holds no file text", async () => {
    const { port } = memoryFilePort(SEEDED);
    const files = new EvalFiles(port);
    const cases = await files.cases();
    expect([(await files.profiles()).items.map((item) => item.id), cases.items.map((item) => item.id), (await files.answerKeys()).items.length, (await files.prompts()).items.length]).toEqual([["p1"], ["greenhouse-4012345"], 1, 1]);
    expect(cases.bad).toEqual([
        { file: "cases/lever-1.json", problem: "not valid JSON" },
        { file: "cases/lever-2.json", problem: "job.days_open: invalid_type" },
        { file: "cases/lever-3.json", problem: "needs upgrade (schema 2)" },
        { file: "cases/lever-4.json", problem: "id lever-9 doesn't match the file name" },
    ]);
});

test("a run's results are read line by line, a bad line named by its number and the rest kept", async () => {
    const lines = [json(result()), json(result({ attempt: 2, score: 101 })), "", json(result({ attempt: 2 }))].join("\n");
    const { port } = memoryFilePort({ "evals/runs/20261103-180000-3f2a/run.json": json(run()), "evals/runs/20261103-180000-3f2a/results.jsonl": `${lines}\n` });
    const files = new EvalFiles(port);
    const runs = await files.runs();
    const results = await files.results("20261103-180000-3f2a");
    expect([runs.items.map((item) => item.id), results.items.map((item) => item.attempt), results.bad]).toEqual([["20261103-180000-3f2a"], [1, 2], [{ file: "runs/20261103-180000-3f2a/results.jsonl:2", problem: "score: too_big" }]]);
});

test("a missing evals folder lists every kind as empty", async () => {
    const files = new EvalFiles(memoryFilePort().port);
    const all = await Promise.all([files.profiles(), files.cases(), files.answerKeys(), files.prompts(), files.runs(), files.results("none")]);
    expect(all).toEqual(Array.from({ length: 6 }, () => ({ items: [], bad: [] })));
});
