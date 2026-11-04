import type { EvalCase, AnswerKey, Profile } from "./format.js";
import type { ExperimentFiles } from "./experimentFiles.js";
import type { Bad, EvalFiles, Loaded, Named } from "./files.js";
import { markerProblems } from "./variant.js";

interface Checked {
    lines: string[];
    code: number;
}

/** Reads every eval file and reports how many of each kind there are and every file that is bad, points at something missing (an answer key with no case, a case with no profile), or is a variant that can't be run. */
export async function checkEvals(files: EvalFiles, experiments: ExperimentFiles): Promise<Checked> {
    const [profiles, cases, answerKeys, prompts, runs] = await Promise.all([files.profiles(), files.cases(), files.answerKeys(), files.prompts(), files.runs()]);
    const [variants, series, seriesRuns] = await Promise.all([experiments.variants(), files.series(), files.seriesRuns()]);
    const results = await Promise.all(runs.items.map((run) => files.results(run.id)));
    const unrunnable = variants.items.flatMap(({ id, value }) => (markerProblems(value.text).length === 0 ? [] : [{ file: `variants/${id}.md`, problem: markerProblems(value.text).join(", ") }]));
    const loaded = [profiles, cases, answerKeys, prompts, runs, variants, series, seriesRuns, ...results];
    const bad = [...loaded.flatMap((each) => each.bad), ...orphansOf({ profiles, cases, answerKeys }), ...unrunnable];
    const counts = [`profiles ${profiles.items.length}`, `cases ${cases.items.length}`, `answer keys ${answerKeys.items.length}`, `prompts ${prompts.items.length}`, `runs ${runs.items.length}`, `variants ${variants.items.length}`, `series ${series.items.length}`, `series runs ${seriesRuns.items.length}`].join(" · ");
    return { lines: [counts, ...bad.map((each) => `bad: ${each.file}: ${each.problem}`)], code: bad.length === 0 ? 0 : 1 };
}

interface Pointed {
    profiles: Loaded<Named<Profile>>;
    cases: Loaded<Named<EvalCase>>;
    answerKeys: Loaded<Named<AnswerKey>>;
}

/** Finds answer keys whose case, and cases whose profile, didn't load, saying whether it is missing or bad. */
function orphansOf({ profiles, cases, answerKeys }: Pointed): Bad[] {
    const caseState = stateIn(cases, "cases");
    const profileState = stateIn(profiles, "profiles");
    const keyless = answerKeys.items.flatMap(({ id }) => {
        const state = caseState(id);
        return state === null ? [] : [{ file: `answer_keys/${id}.json`, problem: state === "bad" ? "orphaned (case is bad)" : "orphaned (no case)" }];
    });
    const profileless = cases.items.flatMap(({ id, value }) => {
        const state = profileState(value.profile);
        return state === null ? [] : [{ file: `cases/${id}.json`, problem: state === "bad" ? `orphaned (profile ${value.profile} is bad)` : `orphaned (no profile ${value.profile})` }];
    });
    return [...keyless, ...profileless];
}

/** Tells whether a file one folder holds loaded, is there but bad, or is missing. */
function stateIn(loaded: Loaded<Named<unknown>>, folder: string): (id: string) => "bad" | "missing" | null {
    const good = new Set(loaded.items.map((each) => each.id));
    const bad = new Set(loaded.bad.map((each) => each.file));
    return (id) => {
        if (good.has(id)) return null;
        return bad.has(`${folder}/${id}.json`) ? "bad" : "missing";
    };
}
