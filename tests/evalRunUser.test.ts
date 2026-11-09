import { expect, test } from "vitest";
import { EvalFiles } from "../src/evals/files.js";
import { parseFile } from "../src/evals/format.js";
import { reportCommand } from "../src/evals/reportCommand.js";
import { summarize } from "../src/evals/report.js";
import { reportLines } from "../src/evals/reportText.js";
import { runSeries, saveSeries } from "../src/evals/series.js";
import { seriesReport } from "../src/evals/seriesReport.js";
import { answerKey, evalCase, parsed, profile, result, run } from "./helpers/evalFixtures.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";
import { scoring, seriesSetup } from "./helpers/seriesSetup.js";

const FIRST = "20261109-090000-aa11";
const SECOND = "20261109-100000-bb22";
const DIFFERENT = "note: these runs were scored for different users (1 and 2)";
const UNRECORDED = "note: a run's user wasn't recorded, so the users can't be checked";

function reportFiles(firstUser: number | undefined, secondUser: number | undefined, caseUser: number | null = 1) {
    const runFile = (id: string, userId: number | undefined) => JSON.stringify(run({ id, endedAt: "2026-11-09T10:05:00.000Z", ...(userId === undefined ? {} : { userId }) }));
    const seed = {
        "evals/profiles/p1.json": JSON.stringify(profile()),
        "evals/cases/greenhouse-4012345.json": JSON.stringify(evalCase(caseUser === null ? {} : { userId: caseUser })),
        "evals/answer_keys/greenhouse-4012345.json": JSON.stringify(answerKey()),
        [`evals/runs/${FIRST}/run.json`]: runFile(FIRST, firstUser),
        [`evals/runs/${FIRST}/results.jsonl`]: `${JSON.stringify(result({ score: 60, passed: false }))}\n`,
        [`evals/runs/${SECOND}/run.json`]: runFile(SECOND, secondUser),
        [`evals/runs/${SECOND}/results.jsonl`]: `${JSON.stringify(result())}\n`,
    };
    const lines: string[] = [];
    const report = async (args: string[]) => {
        lines.length = 0;
        await reportCommand(args, { files: new EvalFiles(memoryFilePort(seed).port), print: (line) => void lines.push(line) });
        return lines;
    };
    return report;
}

const noteAt = (lines: string[]) => lines.findIndex((line) => line.startsWith("note:"));
const comparisonAt = (lines: string[]) => lines.findIndex((line) => line.startsWith("against "));

test("a run records the user it scored for in its run file", async () => {
    const { files, deps } = seriesSetup([scoring(40)], {}, 2);
    await saveSeries(["one", "--test", "now=code"], deps);
    await runSeries("one", deps);
    const runPath = [...files.keys()].find((path) => path.endsWith("/run.json")) ?? "";
    expect((JSON.parse(files.get(runPath) ?? "{}") as { userId?: number }).userId).toBe(2);
});

test("a run file saved before runs recorded their user still reads", () => {
    expect(parseFile("run", run()).ok).toBe(true);
});

test("the report header names the run's user by id, or says it wasn't recorded", () => {
    const header = (overrides: Record<string, unknown>) => reportLines(summarize(parsed("run", run({ endedAt: null, ...overrides })), [], { cases: new Map(), keys: new Map(), profiles: new Map() }), null, false)[0];
    expect([header({ userId: 2 }), header({})]).toEqual(["run 20261103-180000-3f2a · model qwen3 · prompt prompt1 · 1 cases × 2 · user 2 · unfinished", "run 20261103-180000-3f2a · model qwen3 · prompt prompt1 · 1 cases × 2 · user not recorded · unfinished"]);
});

test("comparing runs scored for different users says so just before the comparison", async () => {
    const lines = await reportFiles(1, 2)([SECOND, "--against", FIRST]);
    expect([lines[noteAt(lines)], comparisonAt(lines) - noteAt(lines)]).toEqual([DIFFERENT, 1]);
});

test("comparing with a run whose user wasn't recorded says the users can't be checked, and runs of one user get no note", async () => {
    const unrecorded = await reportFiles(undefined, 1)([SECOND, "--against", FIRST]);
    const same = await reportFiles(2, 2)([SECOND, "--against", FIRST]);
    expect([unrecorded[noteAt(unrecorded)], comparisonAt(unrecorded) - noteAt(unrecorded), noteAt(same)]).toEqual([UNRECORDED, 1, -1]);
});

test("comparing with production's scores says when a case was captured from another user, or a user wasn't recorded", async () => {
    const other = await reportFiles(1, 2, 1)([SECOND, "--against", "observed"]);
    const missing = await reportFiles(1, 2, null)([SECOND, "--against", "observed"]);
    const same = await reportFiles(1, 1, 1)([SECOND, "--against", "observed"]);
    expect([other[noteAt(other)], comparisonAt(other) - noteAt(other), missing[noteAt(missing)], noteAt(same)]).toEqual(["note: some cases were captured from another user's scores", 1, "note: a run's or case's user wasn't recorded, so the users can't be checked", -1]);
});

test("a series report names the user each test's run scored for, and a test with no run shows none", async () => {
    const { files, lines, deps } = seriesSetup([scoring(40)], {}, 2);
    await saveSeries(["half", "--test", "now=code", "--test", "later=code"], deps);
    await runSeries("half", deps);
    const recordPath = [...files.keys()].find((path) => path.startsWith("evals/series-runs/")) ?? "";
    const record = JSON.parse(files.get(recordPath) ?? "{}") as { runs: Record<string, string | null> };
    files.set(recordPath, JSON.stringify({ ...record, runs: { ...record.runs, later: null } }));
    lines.length = 0;
    await seriesReport(["half"], deps);
    expect([lines[2]?.includes(" user 2"), lines[3]?.includes("user")]).toEqual([true, false]);
});
