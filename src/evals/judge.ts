import type { AnswerKey, Result } from "./format.js";

const BORDERLINE_BAND = 10;

type Scored = Pick<Result, "base" | "bonus" | "score" | "reasons" | "gaps" | "failure">;
type Range = AnswerKey["score"];

/** Judges one attempt against its case's answer key at the case's threshold: null without an answer key, false for a failed attempt. */
export function judge(answerKey: AnswerKey | null, attempt: Scored, threshold: number): boolean | null {
    if (answerKey === null) return null;
    if (attempt.failure !== null || attempt.score === null) return false;
    const ranges = within(answerKey.score, attempt.score) && within(answerKey.base, attempt.base) && within(answerKey.bonus, attempt.bonus);
    return verdictHolds(answerKey.verdict, attempt.score, threshold) && ranges && mentions(answerKey.mustMention, [...attempt.reasons, ...attempt.gaps]);
}

/** Tells whether a score passes a verdict at a threshold, by the fixed pass rules. */
function verdictHolds(verdict: AnswerKey["verdict"], score: number, threshold: number): boolean {
    if (verdict === "recommend") return score >= threshold;
    if (verdict === "reject") return score < threshold;
    if (verdict === "zero") return score === 0;
    return Math.abs(score - threshold) <= BORDERLINE_BAND;
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
