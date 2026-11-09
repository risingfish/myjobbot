import { parseArgs } from "node:util";
import { parseFile, type AnswerKey } from "./format.js";
import { passingBand } from "./judge.js";

const RANGE = /^(\d+)-(\d+)$/;
const MAX_HISTORY = 50;
const FLAGS: Record<string, string> = { score: "--score", base: "--base", bonus: "--bonus", mustMention: "--mention", note: "--note" };

export type Entry = Omit<AnswerKey, "schema" | "history">;
type Range = { min: number; max: number } | null;
type ParsedArgs = { ok: true; caseId: string; entry: Entry } | { ok: false; problem: string };

/** Turns the command's arguments into an answer key for one case, checked against the format, naming the flag or field that breaks it. */
export function parseAnswerKeyArgs(args: string[], writtenAt: string): ParsedArgs {
    const read = readArgs(args);
    if (read === null) return { ok: false, problem: "usage" };
    const ranges = [rangeOf("score", read.values.score), rangeOf("base", read.values.base), rangeOf("bonus", read.values.bonus)];
    const broken = ranges.find((range) => "problem" in range);
    if (broken && "problem" in broken) return { ok: false, problem: broken.problem };
    const [score, base, bonus] = ranges.map((range) => ("range" in range ? range.range : null));
    const entry = { verdict: read.verdict, score, base, bonus, mustMention: read.values.mention ?? [], note: read.values.note ?? "", writtenAt };
    const checked = parseFile("answer_key", { schema: 1, ...entry, history: [] });
    if (!checked.ok) return { ok: false, problem: named(checked.problem) };
    return { ok: true, caseId: read.caseId, entry: entryOf(checked.value) };
}

/** Builds a case's new answer key, the one it replaces going first into its history. */
export function rewritten(old: AnswerKey | null, entry: Entry): AnswerKey {
    const history = old === null ? [] : [entryOf(old), ...old.history].slice(0, MAX_HISTORY);
    return { schema: 1, ...entry, history };
}

/** Warns when part of an answer key's score range can't pass its verdict at the case's threshold, or null when all of it can. */
export function rangeWarning(entry: Pick<Entry, "verdict" | "score">, threshold: number): string | null {
    if (entry.score === null) return null;
    const [low, high] = passingBand(entry.verdict, threshold);
    const outside = [entry.score.min < low ? `${entry.score.min}-${Math.min(entry.score.max, low - 1)}` : null, entry.score.max > high ? `${Math.max(entry.score.min, high + 1)}-${entry.score.max}` : null].filter((part) => part !== null);
    return outside.length === 0 ? null : `warning: ${outside.join(", ")} can't pass ${entry.verdict} at threshold ${threshold}`;
}

/** Takes an answer key's own fields, without its format version or history. */
function entryOf({ verdict, score, base, bonus, mustMention, note, writtenAt }: Entry): Entry {
    return { verdict, score, base, bonus, mustMention, note, writtenAt };
}

/** Reads the case id, the verdict and the flags, or null when they don't fit the command's form. */
function readArgs(args: string[]) {
    try {
        const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { score: { type: "string" }, base: { type: "string" }, bonus: { type: "string" }, mention: { type: "string", multiple: true }, note: { type: "string" } } });
        const [caseId, verdict] = positionals;
        return caseId === undefined || verdict === undefined || positionals.length > 2 ? null : { caseId, verdict, values };
    } catch {
        return null;
    }
}

/** Reads one range flag as `min-max`, naming the flag when it isn't one or is out of order. */
function rangeOf(field: string, text: string | undefined): { range: Range } | { problem: string } {
    if (text === undefined) return { range: null };
    const match = RANGE.exec(text);
    if (match === null) return { problem: `${FLAGS[field]}: expected a range like 65-85` };
    const [min, max] = [Number(match[1]), Number(match[2])];
    return min > max ? { problem: `${FLAGS[field]}: min above max` } : { range: { min, max } };
}

/** Names a format problem by the flag that set its field. */
function named(problem: string): string {
    const [path = "", code = ""] = problem.split(": ");
    const field = path.split(".")[0] ?? "";
    return `${FLAGS[field] ?? field}: ${code}`;
}
