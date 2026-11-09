import type { EvalFiles } from "./files.js";
import { parseAnswerKeyArgs, rangeWarning, rewritten, type Entry } from "./answerKeyRules.js";

const USAGE = "usage: myjobbot eval answer-key <case-id> <recommend|borderline|reject|zero> [--score a-b] [--base a-b] [--bonus a-b] [--mention word]... [--note text]";

export interface AnswerKeyDeps {
    files: Pick<EvalFiles, "cases" | "profiles" | "answerKeys" | "writeAnswerKey">;
    now: () => Date;
    print: (line: string) => void;
}

/** Writes one case's answer key, refusing a case that isn't stored, and warns when its range can't pass its verdict. */
export async function answerKeyCommand(args: string[], deps: AnswerKeyDeps): Promise<number> {
    const parsed = parseAnswerKeyArgs(args, deps.now().toISOString());
    if (!parsed.ok) return printed(deps, [parsed.problem === "usage" ? USAGE : `refused ${parsed.problem}`], parsed.problem === "usage" ? 2 : 1);
    const [cases, profiles, keys] = await Promise.all([deps.files.cases(), deps.files.profiles(), deps.files.answerKeys()]);
    const stored = cases.items.find((each) => each.id === parsed.caseId);
    if (stored === undefined) return printed(deps, [`no case ${parsed.caseId}`], 1);
    const old = keys.items.find((each) => each.id === parsed.caseId)?.value ?? null;
    await deps.files.writeAnswerKey(parsed.caseId, rewritten(old, parsed.entry));
    const threshold = profiles.items.find((each) => each.id === stored.value.profile)?.value.matchThreshold;
    const warning = threshold === undefined ? null : rangeWarning(parsed.entry, threshold);
    return printed(deps, [writtenLine(parsed.caseId, parsed.entry), ...(warning === null ? [] : [warning])], 0);
}

/** Says which answer key was written. */
function writtenLine(caseId: string, entry: Entry): string {
    return `answer key written: ${caseId} ${entry.verdict}${entry.score === null ? "" : ` ${entry.score.min}-${entry.score.max}`}`;
}

/** Prints lines and gives back an exit code. */
function printed(deps: AnswerKeyDeps, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}
