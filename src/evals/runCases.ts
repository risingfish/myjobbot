import { parseArgs } from "node:util";
import type { ChatFn } from "../agent/llm.js";
import type { Trace, TraceEvent } from "../agent/trace.js";
import type { AppConfig } from "../config/load.js";
import type { AnswerKey, EvalCase, Profile, Result, Run } from "./format.js";
import type { EvalFiles, Named } from "./files.js";
import { contentId, runId } from "./ids.js";
import { judge } from "./judge.js";
import { attemptLine, summaryLine } from "./runText.js";
import { promptFor, scoreCase } from "./session.js";

const USAGE = "usage: myjobbot eval run [--tag t]... [--case id]... [--repeats N] [--model name]";
const MAX_REPEATS = 20;

export interface RunDeps {
    files: EvalFiles;
    config: AppConfig;
    chatFor: (model: string) => (responseLog: Trace) => ChatFn;
    now: () => Date;
    random: () => number;
    gitCommit: () => string | null;
    print: (line: string) => void;
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
}

/** Scores the chosen cases against the model, each a number of times, saving every attempt judged against its answer key; never writes the database. */
export async function runCases(args: string[], deps: RunDeps): Promise<number> {
    const options = readArgs(args);
    if (options === null) return printed(deps, [USAGE], 2);
    const selection = await select(deps.files, options);
    if (selection.cases.length === 0) return printed(deps, ["no cases to run"], 1);
    const model = options.model ?? deps.config.env.LLM_MODEL;
    const run = await started(deps, selection, { ...options, model });
    const results = await attempts({ deps, run, selection, makeChat: deps.chatFor(model) });
    const endedAt = deps.now().toISOString();
    await deps.files.writeRun({ ...run, endedAt });
    return printed(deps, [summaryLine(run, results, endedAt)], 0);
}

/** Reads the flags, or null when they don't fit the command's form. */
function readArgs(args: string[]) {
    try {
        const options = { tag: { type: "string", multiple: true }, case: { type: "string", multiple: true }, repeats: { type: "string" }, model: { type: "string" } } as const;
        const { values, positionals } = parseArgs({ args, options });
        const repeats = Number(values.repeats ?? "1");
        if (positionals.length > 0 || !Number.isInteger(repeats) || repeats < 1 || repeats > MAX_REPEATS) return null;
        return { tags: values.tag ?? [], ids: values.case ?? [], repeats, model: values.model };
    } catch {
        return null;
    }
}

/** Picks the cases to run, all of them or those with any chosen tag or id, keeping only those whose profile is stored. */
async function select(files: EvalFiles, { tags, ids }: { tags: string[]; ids: string[] }): Promise<Selection> {
    const [cases, profiles, keys] = await Promise.all([files.cases(), files.profiles(), files.answerKeys()]);
    const profileMap = new Map(profiles.items.map((each) => [each.id, each.value]));
    const chosen = cases.items.filter(({ id, value }) => (tags.length === 0 && ids.length === 0) || ids.includes(id) || value.tags.some((tag) => tags.includes(tag)));
    return { cases: chosen.filter((each) => profileMap.has(each.value.profile)), profiles: profileMap, keys: new Map(keys.items.map((each) => [each.id, each.value])) };
}

/** Records the run as begun, with the prompt each profile's cases are scored under, before its first attempt. */
async function started(deps: RunDeps, selection: Selection, options: { tags: string[]; repeats: number; model: string }): Promise<Run> {
    const prompts: Record<string, string> = {};
    for (const id of new Set(selection.cases.map((each) => each.value.profile))) {
        const prompt = { schema: 1 as const, text: promptFor(deps.config, selection.profiles.get(id) as Profile) };
        prompts[id] = contentId({ text: prompt.text });
        await deps.files.writePrompt(prompts[id], prompt);
    }
    const now = deps.now();
    const run: Run = { schema: 1, id: runId(now, deps.random), model: options.model, prompts, repeats: options.repeats, cases: selection.cases.map((each) => each.id), tags: options.tags, gitCommit: deps.gitCommit(), startedAt: now.toISOString(), endedAt: null };
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
async function oneAttempt({ deps, run, selection, makeChat }: Running, each: Named<EvalCase>, attempt: number): Promise<Result> {
    const profile = selection.profiles.get(each.value.profile) as Profile;
    const events: TraceEvent[] = [];
    const scored = await scoreCase(each.value, profile, { config: deps.config, makeChat, trace: { write: (event) => void events.push(event) } });
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
