import { expect, test } from "vitest";
import { runSeries, saveSeries } from "../src/evals/series.js";
import { seriesReport } from "../src/evals/seriesReport.js";
import { formatVariant } from "../src/evals/variant.js";
import { AT } from "./helpers/evalFixtures.js";
import { scoring, seriesSetup, STRICT } from "./helpers/seriesSetup.js";

test("the report sets the tests side by side, each with its pass rate, tokens and time, and puts the cases they split on first", async () => {
    const { lines, deps } = seriesSetup([scoring(40), scoring(20)]);
    await saveSeries(["pair", "--test", "now=code", "--test", "strict=strict"], deps);
    await runSeries("pair", deps);
    lines.length = 0;
    expect(await seriesReport(["pair"], deps)).toBe(0);
    const text = lines.join("\n");
    expect([lines[1], /^ {2}now +code +passed 1\/1 \(100%\) +2\.1k tok +0m0s$/.test(lines[2] ?? ""), /^ {2}strict +strict +passed 0\/1 \(0%\)/.test(lines[3] ?? ""), lines[4], /^ {2}greenhouse-4012345 +Senior Engineer · Acme +pass +fail$/.test(lines[5] ?? ""), text.includes("Build APIs.")]).toEqual(["tests:", true, true, "cases (splits first):", true, false]);
});

test("a test that didn't run shows as not run, and a variant exported before the code's prompt changed is marked", async () => {
    const stale = formatVariant({ header: { schema: 1, exportedAt: AT, exportedFrom: "0000000000000000", gitCommit: null }, text: STRICT });
    const { files, lines, deps } = seriesSetup([scoring(40)], { "evals/variants/old.md": stale });
    await saveSeries(["half", "--test", "old=old", "--test", "later=code"], deps);
    await runSeries("half", deps);
    const recordPath = [...files.keys()].find((path) => path.startsWith("evals/series-runs/")) ?? "";
    const record = JSON.parse(files.get(recordPath) ?? "{}") as { runs: Record<string, string | null>; endedAt: string | null };
    files.set(recordPath, JSON.stringify({ ...record, runs: { ...record.runs, later: null }, endedAt: null }));
    lines.length = 0;
    await seriesReport(["half"], deps);
    expect([lines[0]?.endsWith("· unfinished"), lines[2]?.includes("(prompt changed since export)"), /^ {2}later +code +not run$/.test(lines[3] ?? ""), lines.at(-1)?.trimEnd().endsWith("not run")]).toEqual([true, true, true, true]);
});
