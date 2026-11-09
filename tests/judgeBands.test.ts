import { expect, test } from "vitest";
import { WALL_CLOCK_REASON } from "../src/agent/budget.js";
import { MODEL_ERROR_PREFIX } from "../src/agent/loop.js";
import { failureOf } from "../src/evals/failure.js";
import { judge, passingBand } from "../src/evals/judge.js";
import { answerKey, parsed } from "./helpers/evalFixtures.js";

const VERDICTS = ["recommend", "borderline", "reject", "zero"] as const;
const scored = (score: number) => ({ base: null, bonus: null, score, reasons: [], gaps: [], failure: null });

test("each verdict passes a score at its band's edges and fails one just outside, at any threshold", () => {
    for (const threshold of [0, 10, 70, 100]) {
        for (const verdict of VERDICTS) {
            const key = parsed("answer_key", answerKey({ verdict, score: null }));
            const [low, high] = passingBand(verdict, threshold);
            const edges = low > high ? [] : [low, high];
            const outside = (low > high ? [0, 100] : [low - 1, high + 1]).filter((score) => score >= 0 && score <= 100);
            expect([...edges, ...outside].map((score) => judge(key, scored(score), threshold))).toEqual([...edges.map(() => true), ...outside.map(() => false)]);
        }
    }
});

test("an attempt that ran out of time or whose model failed is classed by the loop's own reasons", () => {
    const tally = { recorded: false, calls: 0, failures: 0 };
    const ended = (reason: string) => failureOf({ reason } as Parameters<typeof failureOf>[0], tally);
    expect([ended(WALL_CLOCK_REASON), ended(`${MODEL_ERROR_PREFIX} timeout`)]).toEqual(["timed_out", "model_error"]);
});
