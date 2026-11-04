import { expect, test } from "vitest";
import { againstObserved, againstRun, summarize, type Context } from "../src/evals/report.js";
import { reportLines } from "../src/evals/reportText.js";
import { answerKey, AT, evalCase, parsed, profile, result, run } from "./helpers/evalFixtures.js";

const LATER = "2026-11-04T09:00:00.000Z";
const second = { id: "lever-7", source: { ats: "lever", jobId: "7" }, title: "Dev", company: "Beta", job: { job_id: "7", title: "Dev", days_open: 12, possible_ghost: false, description: "SECRET DESCRIPTION TEXT" } };

function context(keys: Record<string, Record<string, unknown>> = {}, caseOverrides: Record<string, unknown> = {}): Context {
    const cases = [parsed("case", evalCase(caseOverrides)), parsed("case", evalCase(second))];
    const stored = Object.entries({ "greenhouse-4012345": { score: { min: 65, max: 85 } }, ...keys }).map(([id, fields]) => [id, parsed("answer_key", answerKey(fields))] as const);
    return { cases: new Map(cases.map((each) => [each.id, each])), keys: new Map(stored), profiles: new Map([["p1", parsed("profile", profile())]]) };
}

const theRun = (overrides: Record<string, unknown> = {}) => parsed("run", run({ cases: ["greenhouse-4012345", "lever-7"], repeats: 3, ...overrides }));
const attempts = (id: string, scores: Array<number | null>) => scores.map((score, index) => parsed("result", result({ case: id, attempt: index + 1, score, base: score === null ? null : 40, bonus: score === null ? null : score - 40, failure: score === null ? "no_record" : null, tokensIn: 1000, tokensOut: 100, ms: 2000 })));

test("a run's totals: attempts passed against today's answer keys, cases with keys, and tokens and time per case and in all", () => {
    const report = summarize(theRun(), [...attempts("greenhouse-4012345", [72, 80, null]), ...attempts("lever-7", [50, 52, 51])], context());
    expect([report.passed, report.judged, report.tokensIn, report.tokensOut, report.ms]).toEqual([2, 3, 6000, 600, 12000]);
    expect(report.rows.map((row) => [row.id, row.state, row.median, row.tokens, row.ms])).toEqual([
        ["greenhouse-4012345", "mixed", 76, 3300, 6000],
        ["lever-7", "-", 51, 3300, 6000],
    ]);
});

test("a case is unstable when its attempts both pass and fail, or its scores spread by 10 or more", () => {
    const report = summarize(theRun(), [...attempts("greenhouse-4012345", [70, 70, 71]), ...attempts("lever-7", [40, 45, 50])], context());
    expect(report.rows.map((row) => [row.id, row.range, row.unstable])).toEqual([
        ["greenhouse-4012345", { min: 70, max: 71 }, false],
        ["lever-7", { min: 40, max: 50 }, true],
    ]);
});

test("against another run, the cases that moved are listed, with fixed and broken counted and the change in tokens and time", () => {
    const keys = context({ "lever-7": { verdict: "reject", score: null } });
    const before = summarize(theRun({ id: "20261102-090000-aa11" }), [...attempts("greenhouse-4012345", [60, 61, 62]), ...attempts("lever-7", [55, 56, 57])], keys);
    const after = summarize(
        theRun(),
        [...attempts("greenhouse-4012345", [70, 72, 74]), ...attempts("lever-7", [58, 75, 59])].map((each) => ({ ...each, tokensIn: 1500 })),
        keys,
    );
    const compared = againstRun(after, before);
    expect([compared.passedFrom, compared.passedTo, compared.fixed, compared.broken, compared.tokens, compared.ms]).toEqual([3, 5, 1, 1, (9600 - 6600) / 6600, 0]);
    expect(compared.moves.map((move) => [move.id, move.from, move.to, move.fromScore, move.toScore])).toEqual([
        ["greenhouse-4012345", "fail", "pass", 61, 72],
        ["lever-7", "pass", "mixed", 56, 59],
    ]);
});

test("against production's scores, cases scored from the summary, unknown, or before their description arrived are left out and counted", () => {
    const summaryOnly = context({}, { observed: { base: 40, bonus: 32, score: 72, reasons: [], gaps: [], scoredAt: "2026-10-27T13:00:00.000Z", runId: "r", read: "summary" } });
    const changed = context({}, { descriptionChangedSinceScored: true });
    const results = [...attempts("greenhouse-4012345", [50, 52, 51]), ...attempts("lever-7", [60, 60, 60])];
    const fair = againstObserved(summarize(theRun(), results, context()), context());
    expect([fair.compared, fair.moves.map((move) => [move.id, move.from, move.to, move.fromScore, move.toScore]), fair.leftOut]).toEqual([
        2,
        [
            ["greenhouse-4012345", "pass", "fail", 72, 51],
            ["lever-7", "-", "-", 72, 60],
        ],
        { summary: 0, unknown: 0, changed: 0 },
    ]);
    expect([againstObserved(summarize(theRun(), results, summaryOnly), summaryOnly).leftOut, againstObserved(summarize(theRun(), results, changed), changed).leftOut]).toEqual([
        { summary: 1, unknown: 0, changed: 0 },
        { summary: 0, unknown: 0, changed: 1 },
    ]);
});

test("the report names each case by title and company, never its description, shows reasons only when asked, an unfinished run, and keys changed since", () => {
    const keys = context({ "greenhouse-4012345": { score: { min: 65, max: 85 }, writtenAt: LATER } });
    const report = summarize(theRun({ endedAt: null }), [...attempts("greenhouse-4012345", [52, 58, 61]).map((each) => ({ ...each, reasons: ["Go only"], gaps: ["no TypeScript"] })), ...attempts("lever-7", [50, 50, 50])], keys);
    const plain = reportLines(report, null, false).join("\n");
    const detailed = reportLines(report, null, true).join("\n");
    expect([plain.includes("Senior Engineer · Acme"), plain.includes("Dev · Beta"), plain.includes("SECRET"), plain.includes("Go only"), detailed.includes("#1 reasons: Go only · gaps: no TypeScript"), detailed.includes("SECRET")]).toEqual([true, true, false, false, true, false]);
    expect([plain.split("\n")[0], plain.includes("answer key changed since the run: greenhouse-4012345"), plain.includes(`recommend 65-85`), plain.includes(AT)]).toEqual(["run 20261103-180000-3f2a · model qwen3 · prompt prompt1 · 2 cases × 3 · unfinished", true, true, false]);
});

test("a run made with a variant names it in the header, and says when the code's prompt had changed since its export; an older run reads as the code's prompt", () => {
    const header = (overrides: Record<string, unknown>) => reportLines(summarize(theRun({ endedAt: AT, ...overrides }), [], context()), null, false)[0];
    expect([header({ variant: "strict", promptChanged: false }), header({ variant: "old", promptChanged: true }), header({})]).toEqual(["run 20261103-180000-3f2a · model qwen3 · prompt prompt1 · 2 cases × 3 · variant strict", "run 20261103-180000-3f2a · model qwen3 · prompt prompt1 · 2 cases × 3 · variant old · prompt changed since export", "run 20261103-180000-3f2a · model qwen3 · prompt prompt1 · 2 cases × 3"]);
});
