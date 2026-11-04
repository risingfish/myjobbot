import { expect, test } from "vitest";
import { judge } from "../src/evals/judge.js";
import { answerKey, parsed } from "./helpers/evalFixtures.js";

const key = (overrides: Record<string, unknown> = {}) => parsed("answer_key", answerKey({ score: null, ...overrides }));
const attempt = (score: number | null, overrides: Record<string, unknown> = {}) => ({ base: score === null ? null : Math.floor(score / 2), bonus: score === null ? null : Math.ceil(score / 2), score, reasons: ["Strong TypeScript"], gaps: ["no Kafka"], failure: null, ...overrides });

test("recommend passes at or above the threshold and reject below it", () => {
    expect([judge(key(), attempt(60), 60), judge(key(), attempt(59), 60), judge(key({ verdict: "reject" }), attempt(59), 60), judge(key({ verdict: "reject" }), attempt(60), 60)]).toEqual([true, false, true, false]);
});

test("borderline passes within 10 points either side of the threshold, and zero only at 0", () => {
    const borderline = key({ verdict: "borderline" });
    expect([judge(borderline, attempt(50), 60), judge(borderline, attempt(70), 60), judge(borderline, attempt(71), 60), judge(key({ verdict: "zero" }), attempt(0), 60), judge(key({ verdict: "zero" }), attempt(1), 60)]).toEqual([true, true, false, true, false]);
});

test("a range or a word to mention that doesn't hold fails a verdict that does, words matching in reasons or gaps whatever their case", () => {
    expect([judge(key({ score: { min: 65, max: 85 } }), attempt(62), 60), judge(key({ bonus: { min: 40, max: 50 } }), attempt(70), 60), judge(key({ mustMention: ["typescript", "KAFKA"] }), attempt(70), 60), judge(key({ mustMention: ["Go"] }), attempt(70, { reasons: [], gaps: [] }), 60)]).toEqual([false, false, true, false]);
});

test("a failed attempt never passes, and a case without an answer key isn't judged", () => {
    expect([judge(key({ verdict: "zero" }), attempt(null, { failure: "no_record" }), 60), judge(null, attempt(70), 60)]).toEqual([false, null]);
});
