import { expect, test } from "vitest";
import type { HistoryEntry, ScoreDetail } from "../src/web/api.js";
import { scoreRun } from "../src/web/scoreRun.js";

const SCORE: ScoreDetail = { total: 75, model: 70, boost: null, base: 40, bonus: 30, reasons: [], gaps: [], scoredAt: "2026-11-12 17:04" };

function entry(scoredAt: string, run: string | null, total: number | null = 70): HistoryEntry {
    return { scoredAt, total, base: null, bonus: null, run, rescore: null };
}

test("the current score's run is the verdict scored at the same minute", () => {
    expect(scoreRun({ score: SCORE, history: [entry("2026-11-12 18:00", "later", null), entry("2026-11-12 17:04", "1dffa99e"), entry("2026-11-11 01:06", "2ea8b615")] })).toBe("1dffa99e");
});

test("there is no run for an unscored job, a score with no time, or a time no verdict matches", () => {
    expect([scoreRun({ score: null, history: [entry("2026-11-12 17:04", "a")] }), scoreRun({ score: { ...SCORE, scoredAt: null }, history: [] }), scoreRun({ score: SCORE, history: [entry("2026-11-12 17:04", "a", null)] })]).toEqual([null, null, null]);
});
