import { expect, test } from "vitest";
import { parseFile, type FileKind } from "../src/evals/format.js";
import { answerKey, evalCase, profile, result, run } from "./helpers/evalFixtures.js";

function problem(kind: FileKind, raw: unknown): string | null {
    const parsed = parseFile(kind, raw);
    return parsed.ok ? null : parsed.problem;
}

test("a full profile, case, answer key, prompt, run and result parse", () => {
    const files: Array<[FileKind, unknown]> = [
        ["profile", profile()],
        ["case", evalCase()],
        ["answer_key", answerKey()],
        ["prompt", { schema: 1, text: "You are myjobbot. {open} … {close}" }],
        ["run", run()],
        ["result", result()],
    ];
    expect(files.map(([kind, raw]) => problem(kind, raw))).toEqual([null, null, null, null, null, null]);
});

test("unknown fields are refused, and another format version is told apart as needing an upgrade", () => {
    expect([problem("profile", profile({ extra: 1 })), problem("case", evalCase({ schema: 2 })), problem("answer_key", { verdict: "zero" }), problem("result", "not an object")]).toEqual(["(root): unrecognized_keys", "needs upgrade (schema 2)", "schema: invalid_value", "(root): invalid_type"]);
});

test("a case's dates must agree: the shift, the age sent, and no shift without an observed score", () => {
    const dates = { capturedAt: "2026-11-03T18:00:00.000Z", daysOpenAtCapture: 19, daysOpenAsScored: 12, shiftedDays: 7 };
    expect([problem("case", evalCase({ dates: { ...dates, shiftedDays: 6 } })), problem("case", evalCase({ job: { job_id: "4012345", title: "Senior Engineer", days_open: 19, possible_ghost: false } })), problem("case", evalCase({ observed: null })), problem("case", evalCase({ observed: null, dates: { ...dates, daysOpenAsScored: 19, shiftedDays: 0 }, job: { job_id: "1", title: "t", days_open: 19, possible_ghost: false } }))]).toEqual(["dates.shiftedDays: custom", "job.days_open: custom", "dates.shiftedDays: custom", null]);
});

test("an answer key keeps to its scale: the four verdicts, ranges within limits, and short words and notes", () => {
    const refused = [answerKey({ verdict: "maybe" }), answerKey({ score: { min: 90, max: 80 } }), answerKey({ score: { min: -1, max: 5 } }), answerKey({ bonus: { min: 10, max: 51 } }), answerKey({ mustMention: Array.from({ length: 11 }, (_, index) => `w${index}`) }), answerKey({ mustMention: ["x".repeat(61)] }), answerKey({ note: "x".repeat(2001) })];
    expect(refused.map((raw) => problem("answer_key", raw))).toEqual(["verdict: invalid_value", "score: custom", "score.min: too_small", "bonus.max: too_big", "mustMention: too_big", "mustMention.0: too_big", "note: too_big"]);
    const earlier = { verdict: "borderline", score: null, base: null, bonus: null, mustMention: [], note: "", writtenAt: "2026-11-01T09:00:00.000Z" };
    expect([problem("answer_key", answerKey({ verdict: "zero", score: null, history: [earlier] })), problem("answer_key", answerKey({ history: [{ ...earlier, history: [] }] }))]).toEqual([null, "history.0: unrecognized_keys"]);
});

test("tags are short lowercase words, at most 20", () => {
    expect([problem("case", evalCase({ tags: ["Upper"] })), problem("case", evalCase({ tags: Array.from({ length: 21 }, (_, index) => `t${index}`) })), problem("case", evalCase({ tags: ["remote-us", "level-1"] }))]).toEqual(["tags.0: invalid_format", "tags: too_big", null]);
});

test("a run needs cases, a prompt and 1 to 20 repeats, and a result a fixed failure code and an attempt from 1", () => {
    expect([problem("run", run({ cases: [] })), problem("run", run({ prompts: {} })), problem("run", run({ repeats: 21 })), problem("result", result({ failure: "the model said no" })), problem("result", result({ attempt: 0 })), problem("result", result({ failure: "model_error", base: null, bonus: null, score: null, passed: false }))]).toEqual(["cases: too_small", "prompts: custom", "repeats: too_big", "failure: invalid_value", "attempt: too_small", null]);
});
