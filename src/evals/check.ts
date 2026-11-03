import type { Bad, EvalFiles } from "./files.js";

interface Checked {
    lines: string[];
    code: number;
}

/** Reads every eval file and reports how many of each kind there are and every file that is bad or points at something missing (an answer key with no case, a case with no profile). */
export async function checkEvals(files: EvalFiles): Promise<Checked> {
    const [profiles, cases, answerKeys, prompts, runs] = await Promise.all([files.profiles(), files.cases(), files.answerKeys(), files.prompts(), files.runs()]);
    const results = await Promise.all(runs.items.map((run) => files.results(run.id)));
    const caseIds = new Set(cases.items.map((each) => each.id));
    const profileIds = new Set(profiles.items.map((each) => each.id));
    const orphans: Bad[] = [...answerKeys.items.filter((each) => !caseIds.has(each.id)).map((each) => ({ file: `answer_keys/${each.id}.json`, problem: "orphaned (no case)" })), ...cases.items.filter((each) => !profileIds.has(each.value.profile)).map((each) => ({ file: `cases/${each.id}.json`, problem: `orphaned (no profile ${each.value.profile})` }))];
    const bad = [...[profiles, cases, answerKeys, prompts, runs, ...results].flatMap((loaded) => loaded.bad), ...orphans];
    const counts = `profiles ${profiles.items.length} · cases ${cases.items.length} · answer keys ${answerKeys.items.length} · prompts ${prompts.items.length} · runs ${runs.items.length}`;
    return { lines: [counts, ...bad.map((each) => `bad: ${each.file}: ${each.problem}`)], code: bad.length === 0 ? 0 : 1 };
}
