import { parseArgs } from "node:util";
import type { ChatFn } from "../agent/llm.js";
import type { Trace, TraceEvent } from "../agent/trace.js";
import type { AppConfig } from "../config/load.js";
import { READS_PROFILE, RESUME_VIEWS, type ResumeView } from "../config/schema.js";
import type { AnswerKey, EvalCase, Profile, Result, Run } from "./format.js";
import type { EvalFiles, Named } from "./files.js";
import { contentId, runId } from "./ids.js";
import { judge } from "./judge.js";
import { attemptLine, summaryLine } from "./runText.js";
import { promptFor, scoreCase } from "./session.js";
import type { ExperimentFiles } from "./experimentFiles.js";
import { loadVariant } from "./variantCheck.js";

const USAGE = `usage: myjobbot eval run [--tag t]... [--case id]... [--repeats N] [--model name] [--variant name] [--view ${RESUME_VIEWS.join("|")}]`;
const MAX_REPEATS = 20;

export interface RunDeps {
    files: EvalFiles;
    experiments: ExperimentFiles;
    config: AppConfig;
    chatFor: (model: string) => (responseLog: Trace) => ChatFn;
    now: () => Date;
    random: () => number;
    gitCommit: () => string | null;
    print: (line: string) => void;
    userId: number;
    uuid: () => string;
}

interface Selection {
    cases: Array<Named<EvalCase>>;
    profiles: Map<string, Profile>;
    keys: Map<string, AnswerKey>;
}

interface Running {
    deps: RunDeps;
    run: Run;
    selection: Selection;
    makeChat: (responseLog: Trace) => ChatFn;
    template: string | undefined;
}

interface ChosenPrompt {
    template: string | undefined;
    variant: string | null;
    drifted: boolean;
}

interface Starting {
    deps: RunDeps;
    selection: Selection;
    prompt: ChosenPrompt;
}

export interface RunOptions {
    tags: string[];
    ids: string[];
    repeats: number;
    model: string | undefined;
    variant: string | null;
    view: ResumeView;
}

/** Scores the chosen cases against the model, each a number of times, saving every attempt judged against its answer key; never writes the database. */
export async function runCases(args: string[], deps: RunDeps): Promise<number> {
    const options = readArgs(args);
    if (options === null) return printed(deps, [USAGE], 2);
    return (await executeRun(options, deps)).code;
}

/** Runs already-chosen options: checks the variant, if any, and that a view needing a resume profile has one for every case, then scores every case with that view and ends the run, giving the exit code and the run made. */
export async function executeRun(options: RunOptions, given: RunDeps): Promise<{ code: number; run: Run | null }> {
    const deps = { ...given, config: { ...given.config, settings: { ...given.config.settings, resume_view: options.view } } };
    const prompt = await promptOf(options.variant, deps);
    if ("refusal" in prompt) return { code: printed(deps, [prompt.refusal], 1), run: null };
    const selection = await select(deps.files, options);
    if (selection.cases.length === 0) return { code: printed(deps, ["no cases to run"], 1), run: null };
    const refusal = viewRefusal(selection, options.view);
    if (refusal !== null) return { code: printed(deps, [refusal], 1), run: null };
    const model = options.model ?? deps.config.env.LLM_MODEL;
    const run = await started({ deps, selection, prompt }, { ...options, model });
    const results = await attempts({ deps, run, selection, makeChat: deps.chatFor(model), template: prompt.template });
    const endedAt = deps.now().toISOString();
    await deps.files.writeRun({ ...run, endedAt });
    return { code: printed(deps, [summaryLine(run, results, endedAt)], 0), run: { ...run, endedAt } };
}

/** Says why a view that reads the resume profile can't run, naming the first case whose profile was captured without one, or null when it can. */
function viewRefusal(selection: Selection, view: ResumeView): string | null {
    if (!READS_PROFILE[view]) return null;
    const missing = selection.cases.find((each) => selection.profiles.get(each.value.profile)?.resumeProfile === undefined);
    return missing === undefined ? null : `refused view ${view}: case ${missing.id} was captured without a resume profile`;
}

/** Picks the template a run scores with: the code's, or a variant's once it passes its checks, warning when the code has changed since its export. */
async function promptOf(name: string | null, deps: RunDeps): Promise<ChosenPrompt | { refusal: string }> {
    if (name === null) return { template: undefined, variant: null, drifted: false };
    const loaded = await loadVariant(deps.experiments, name);
    if (!loaded.ok) return { refusal: loaded.refusal };
    if (loaded.drifted) deps.print(`warning: the code's prompt has changed since ${name} was exported`);
    return { template: loaded.variant.text, variant: name, drifted: loaded.drifted };
}

/** Reads the flags, or null when they don't fit the command's form. */
function readArgs(args: string[]) {
    try {
        const options = { tag: { type: "string", multiple: true }, case: { type: "string", multiple: true }, repeats: { type: "string" }, model: { type: "string" }, variant: { type: "string" }, view: { type: "string" } } as const;
        const { values, positionals } = parseArgs({ args, options });
        const repeats = repeatsOf(values.repeats);
        const view = RESUME_VIEWS.find((each) => each === (values.view ?? "resume"));
        if (positionals.length > 0 || repeats === null || view === undefined) return null;
        return { tags: values.tag ?? [], ids: values.case ?? [], repeats, model: values.model, variant: values.variant ?? null, view };
    } catch {
        return null;
    }
}

/** Reads how many times each case is scored, one by default, or null when it isn't a whole number from 1 to the limit. */
function repeatsOf(text: string | undefined): number | null {
    const repeats = Number(text ?? "1");
    return Number.isInteger(repeats) && repeats >= 1 && repeats <= MAX_REPEATS ? repeats : null;
}

/** Picks the cases to run, all of them or those with any chosen tag or id, keeping only those whose profile is stored. */
async function select(files: EvalFiles, { tags, ids }: { tags: string[]; ids: string[] }): Promise<Selection> {
    const [cases, profiles, keys] = await Promise.all([files.cases(), files.profiles(), files.answerKeys()]);
    const profileMap = new Map(profiles.items.map((each) => [each.id, each.value]));
    const chosen = cases.items.filter(({ id, value }) => (tags.length === 0 && ids.length === 0) || ids.includes(id) || value.tags.some((tag) => tags.includes(tag)));
    return { cases: chosen.filter((each) => profileMap.has(each.value.profile)), profiles: profileMap, keys: new Map(keys.items.map((each) => [each.id, each.value])) };
}

/** Records the run as begun, with the prompt each profile's cases are scored under and the variant it came from, before its first attempt. */
async function started({ deps, selection, prompt: chosen }: Starting, options: { tags: string[]; repeats: number; model: string; view: ResumeView }): Promise<Run> {
    const prompts: Record<string, string> = {};
    for (const id of new Set(selection.cases.map((each) => each.value.profile))) {
        const prompt = { schema: 1 as const, text: promptFor(deps.config, selection.profiles.get(id) as Profile, chosen.template) };
        prompts[id] = contentId({ text: prompt.text });
        await deps.files.writePrompt(prompts[id], prompt);
    }
    const now = deps.now();
    const run: Run = { schema: 1, id: runId(now, deps.random), model: options.model, prompts, repeats: options.repeats, cases: selection.cases.map((each) => each.id), tags: options.tags, gitCommit: deps.gitCommit(), startedAt: now.toISOString(), endedAt: null, variant: chosen.variant, promptChanged: chosen.drifted, view: options.view, userId: deps.userId };
    await deps.files.writeRun(run);
    return run;
}

/** Scores every case the run's number of times, saving and printing each attempt as it ends. */
async function attempts(running: Running): Promise<Result[]> {
    const { run, selection } = running;
    const results: Result[] = [];
    const total = selection.cases.length * run.repeats;
    for (const each of selection.cases) {
        for (let attempt = 1; attempt <= run.repeats; attempt++) {
            const result = await oneAttempt(running, each, attempt);
            results.push(result);
            running.deps.print(attemptLine(results.length, total, result));
        }
    }
    return results;
}

/** Scores one case once and saves its result, judged against the case's answer key as it stands now, and its trace. */
async function oneAttempt({ deps, run, selection, makeChat, template }: Running, each: Named<EvalCase>, attempt: number): Promise<Result> {
    const profile = selection.profiles.get(each.value.profile) as Profile;
    const events: TraceEvent[] = [];
    const scored = await scoreCase(each.value, profile, { config: deps.config, makeChat, template, trace: { write: (event) => void events.push(event) }, clock: () => deps.now().getTime(), markerTag: deps.uuid });
    const passed = judge(selection.keys.get(each.id) ?? null, scored, profile.matchThreshold);
    const result: Result = { schema: 1, case: each.id, attempt, ...scored, passed };
    await deps.files.appendResult(run.id, result);
    await deps.files.appendTrace(run.id, events);
    return result;
}

/** Prints lines and gives back an exit code. */
function printed(deps: RunDeps, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}
