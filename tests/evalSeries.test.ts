import { expect, test } from "vitest";
import { runSeries, saveSeries } from "../src/evals/series.js";
import { textReply } from "./helpers/chat.js";
import { scoring, seriesSetup, variantFile } from "./helpers/seriesSetup.js";

const SAVE = ["try", "--tag", "seniority-edge", "--repeats", "1", "--test", "now=code", "--test", "strict=strict", "--test", "big=strict@llama3"];

test("a series is saved with its cases, repeats and tests, and one already saved is kept unless replaced", async () => {
    const { files, lines, deps } = seriesSetup([]);
    expect([await saveSeries(SAVE, deps), await saveSeries(SAVE, deps), await saveSeries([...SAVE, "--fresh"], deps)]).toEqual([0, 0, 0]);
    const saved = JSON.parse(files.get("evals/series/try.json") ?? "{}") as { tests: unknown[]; tags: string[]; repeats: number };
    expect([saved.tests, saved.tags, saved.repeats, lines.slice(0, 2)]).toEqual([
        [
            { label: "now", variant: null, model: null },
            { label: "strict", variant: "strict", model: null },
            { label: "big", variant: "strict", model: "llama3" },
        ],
        ["seniority-edge"],
        1,
        ["saved series try · 3 tests · tag seniority-edge × 1", "exists: try"],
    ]);
});

test("a series with a repeated label, a test that isn't label=variant, or no tests at all is refused", async () => {
    const { lines, deps } = seriesSetup([]);
    const codes = [await saveSeries(["dup", "--test", "a=code", "--test", "a=strict"], deps), await saveSeries(["bad", "--test", "nonsense"], deps), await saveSeries(["empty"], deps)];
    expect([codes, lines.slice(0, 2)]).toEqual([
        [1, 1, 2],
        ["refused series dup: tests: custom", "refused series bad: test nonsense isn't <label>=<variant|code>[+view][@model]"],
    ]);
});

test("running a series refuses the whole of it before any model call when a test's variant is missing or can't be run", async () => {
    const { lines, models, deps } = seriesSetup([], { "evals/variants/unsafe.md": variantFile("{threshold} {preferences}") });
    await saveSeries(["risky", "--test", "now=code", "--test", "gone=missing", "--test", "unsafe=unsafe"], deps);
    expect([await runSeries("risky", deps), lines.slice(1), models]).toEqual([1, ["refused series risky: test gone: refused variant missing: no such variant", "refused series risky: test unsafe: refused variant unsafe: missing {data}"], []]);
});

test("a series runs its tests in order as ordinary runs, records each test's run as it goes, and running it again makes new runs", async () => {
    const { files, models, deps } = seriesSetup([scoring(40), scoring(20), scoring(40), Array.from({ length: 8 }, () => textReply("hmm"))]);
    await saveSeries(["pair", "--test", "now=code", "--test", "strict=strict@llama3"], deps);
    expect([await runSeries("pair", deps), await runSeries("pair", deps)]).toEqual([0, 0]);
    const records = [...files.keys()].filter((path) => path.startsWith("evals/series-runs/")).map((path) => JSON.parse(files.get(path) ?? "{}") as { runs: Record<string, string | null>; endedAt: string | null });
    const runIds = records.flatMap((record) => Object.values(record.runs));
    expect([records.length, records.every((record) => record.endedAt !== null), new Set(runIds).size, runIds.every((id) => id !== null && files.has(`evals/runs/${id}/run.json`)), models]).toEqual([2, true, 4, true, ["test-model", "llama3", "test-model", "llama3"]]);
});
