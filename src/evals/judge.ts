import type { AnswerKey, Result } from "./format.js";

const BORDERLINE_BAND = 10;

const PASS_BANDS: Record<AnswerKey["verdict"], (threshold: number) => [number, number]> = {
    recommend: (threshold) => [threshold, 100],
    reject: (threshold) => [0, threshold - 1],
    zero: () => [0, 0],
    borderline: (threshold) => [Math.max(0, threshold - BORDERLINE_BAND), Math.min(100, threshold + BORDERLINE_BAND)],
};

type Scored = Pick<Result, "base" | "bonus" | "score" | "reasons" | "gaps" | "failure">;
type Range = AnswerKey["score"];

/** Judges one attempt against its case's answer key at the case's threshold: null without an answer key, false for a failed attempt. */
export function judge(answerKey: AnswerKey | null, attempt: Scored, threshold: number): boolean | null {
    if (answerKey === null) return null;
    if (attempt.failure !== null || attempt.score === null) return false;
    const ranges = within(answerKey.score, attempt.score) && within(answerKey.base, attempt.base) && within(answerKey.bonus, attempt.bonus);
    return verdictHolds(answerKey.verdict, attempt.score, threshold) && ranges && mentions(answerKey.mustMention, [...attempt.reasons, ...attempt.gaps]);
}

/** Gives the scores at which a verdict passes at a threshold, from the fixed pass rules. */
export function passingBand(verdict: AnswerKey["verdict"], threshold: number): [number, number] {
    return PASS_BANDS[verdict](threshold);
}

/** Tells whether a score passes a verdict at a threshold, by lying in the verdict's band. */
function verdictHolds(verdict: AnswerKey["verdict"], score: number, threshold: number): boolean {
    const [low, high] = passingBand(verdict, threshold);
    return score >= low && score <= high;
}

/** Tells whether a value falls in a range, any value passing when no range is given. */
function within(range: Range, value: number | null): boolean {
    return range === null || (value !== null && value >= range.min && value <= range.max);
}

/** Tells whether every word the answer key asks for appears in the reasons or gaps, ignoring case. */
function mentions(words: string[], notes: string[]): boolean {
    const text = notes.join("\n").toLowerCase();
    return words.every((word) => text.includes(word.toLowerCase()));
}
