import { expect, test } from "vitest";
import { answerKeyCommand } from "../src/evals/answerKey.js";
import { parseAnswerKeyArgs, rangeWarning, rewritten } from "../src/evals/answerKeyRules.js";
import { EvalFiles } from "../src/evals/files.js";
import { answerKey, AT, evalCase, parsed, profile } from "./helpers/evalFixtures.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";

test("the arguments become an answer key: the case, the verdict, its ranges, mention words and note", () => {
    const args = ["greenhouse-4012345", "recommend", "--score", "65-85", "--bonus", "25-40", "--mention", "TypeScript", "--mention", "remote", "--note", "stack matches"];
    expect(parseAnswerKeyArgs(args, AT)).toEqual({ ok: true, caseId: "greenhouse-4012345", entry: { verdict: "recommend", score: { min: 65, max: 85 }, base: null, bonus: { min: 25, max: 40 }, mustMention: ["TypeScript", "remote"], note: "stack matches", writtenAt: AT } });
    expect(parseAnswerKeyArgs(["lever-9", "zero"], AT)).toMatchObject({ ok: true, entry: { verdict: "zero", score: null, mustMention: [], note: "" } });
});

test("a range out of order, not a range, or outside its limits, and a verdict off the scale, are refused naming what is wrong", () => {
    const refused = [["c", "recommend", "--score", "90-80"], ["c", "recommend", "--score", "x-5"], ["c", "recommend", "--base", "10-51"], ["c", "maybe"], ["c"], ["c", "reject", "--colour", "red"]];
    expect(refused.map((args) => parseAnswerKeyArgs(args, AT))).toEqual([
        { ok: false, problem: "--score: min above max" },
        { ok: false, problem: "--score: expected a range like 65-85" },
        { ok: false, problem: "--base: too_big" },
        { ok: false, problem: "verdict: invalid_value" },
        { ok: false, problem: "usage" },
        { ok: false, problem: "usage" },
    ]);
});

test("rewriting an answer key keeps the earlier one first in its history, at most 50", () => {
    const entry = (note: string) => ({ verdict: "reject" as const, score: null, base: null, bonus: null, mustMention: [], note, writtenAt: AT });
    const old = parsed("answer_key", answerKey({ note: "first", history: Array.from({ length: 50 }, (_, index) => entry(`h${index}`)) }));
    const next = rewritten(old, entry("second"));
    expect([next.note, next.history.length, next.history[0]?.note, next.history[49]?.note, rewritten(null, entry("only")).history]).toEqual(["second", 50, "first", "h48", []]);
});

test("the command saves an answer key for a stored case, warning when a range can't pass its verdict, and refuses a case that isn't stored", async () => {
    const { port, files } = memoryFilePort({ "evals/profiles/p1.json": JSON.stringify(profile()), "evals/cases/greenhouse-4012345.json": JSON.stringify(evalCase()) });
    const lines: string[] = [];
    const deps = { files: new EvalFiles(port), now: () => new Date(AT), print: (line: string) => void lines.push(line) };
    const codes = [await answerKeyCommand(["greenhouse-4012345", "recommend", "--score", "65-85"], deps), await answerKeyCommand(["greenhouse-4012345", "borderline"], deps), await answerKeyCommand(["lever-1", "reject"], deps)];
    const saved = JSON.parse(files.get("evals/answer_keys/greenhouse-4012345.json") ?? "{}") as { verdict: string; history: Array<{ verdict: string }> };
    expect([codes, lines, saved.verdict, saved.history.map((each) => each.verdict)]).toEqual([[0, 0, 1], ["answer key written: greenhouse-4012345 recommend 65-85", "warning: 65-69 can't pass recommend at threshold 70", "answer key written: greenhouse-4012345 borderline", "no case lever-1"], "borderline", ["recommend"]]);
    expect([rangeWarning({ verdict: "recommend", score: { min: 70, max: 85 } }, 70), rangeWarning({ verdict: "reject", score: { min: 50, max: 75 } }, 70), rangeWarning({ verdict: "zero", score: { min: 0, max: 5 } }, 70)]).toEqual([null, "warning: 70-75 can't pass reject at threshold 70", "warning: 1-5 can't pass zero at threshold 70"]);
});
