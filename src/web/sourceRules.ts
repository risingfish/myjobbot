import type { z } from "zod";
import { REFRESH_GRACE_HOURS } from "../config/schema.js";
import type { NewSource, SavedSource } from "../db/sourceStore.js";
import { ALERTS_SOURCE } from "../gmail/alertJobs/source.js";
import type { SourceModule } from "../sources/module.js";
import { moduleFor } from "../sources/registry.js";
import type { Problem } from "./settingsProblems.js";
import { unmetNeed, type Met } from "./sourceChoices.js";
import { fieldParams, NAME_FIELD, type SourceDraft } from "./sourceForm.js";

export interface SearchLimits {
    monthly_request_cap: number;
    refresh_hours: number;
}

export interface SaveFacts {
    saved: SavedSource[];
    limits: SearchLimits;
    met: Met;
}

export type SourcePlan = { problems: Problem[] } | { source: NewSource | SavedSource };

interface DraftTarget {
    module: SourceModule<unknown>;
    existing: SavedSource | null;
}

const HOURS_PER_MONTH = 30 * 24;

const NOT_SAVABLE = "not a source you can save here";

const OVER_BUDGET = "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours";

/** Says why a saved source can't be turned on, or null when it can: a scheduled search that would take JSearch past its monthly budget is refused. */
export function enableProblem(saved: SavedSource[], id: number, limits: SearchLimits): string | null {
    const source = saved.find((candidate) => candidate.id === id);
    if (source === undefined || source.enabled || !isScheduled(source.module)) return null;
    return fitsBudget(scheduledOn(saved), limits) ? null : OVER_BUDGET;
}

/** Decides what saving a source's form stores, a new source or the saved one with its new fields, or why the save is refused, before anything is stored. */
export function saveSourcePlan(draft: SourceDraft, facts: SaveFacts): SourcePlan {
    const target = draftTarget(draft, facts);
    if ("problems" in target) return target;
    const { module, existing } = target;
    const others = facts.saved.filter((source) => source.id !== draft.id);
    const name = draft.name.trim();
    const params = module.params.safeParse(fieldParams(module.fields, draft.values));
    if (!params.success) return { problems: [...nameProblems(name, others), ...fieldProblems(params.error)] };
    const source = { module: module.id, name, params: params.data, target: module.target(params.data), enabled: existing?.enabled ?? true };
    const problems = [...nameProblems(name, others), ...sourceProblems(source, others, facts.limits)];
    return problems.length > 0 ? { problems } : { source: existing === null ? source : { ...existing, ...source } };
}

/** Finds the module a draft is for and the saved source it edits, or why it can't be saved here. */
function draftTarget(draft: SourceDraft, facts: SaveFacts): DraftTarget | { problems: Problem[] } {
    const module = moduleFor(draft.module);
    if (module === null || module.scope === "account") return refused(NOT_SAVABLE);
    const existing = draft.id === null ? null : (facts.saved.find((source) => source.id === draft.id && source.module === draft.module) ?? null);
    if (draft.id !== null && existing === null) return refused(NOT_SAVABLE);
    const need = unmetNeed(module, facts.met);
    return need === null ? { module, existing } : refused(need);
}

/** Refuses a save with one problem at the top of the form. */
function refused(message: string): { problems: Problem[] } {
    return { problems: [{ field: null, entry: null, message }] };
}

/** Finds what is wrong with a source's name: blank, reserved for Gmail alerts, or already another source's, ignoring case. */
function nameProblems(name: string, others: SavedSource[]): Problem[] {
    const lower = name.toLowerCase();
    if (name === "") return [nameProblem("a source needs a name")];
    if (lower === ALERTS_SOURCE.toLowerCase()) return [nameProblem(`"${ALERTS_SOURCE}" is a reserved source name`)];
    return others.some((other) => other.name.toLowerCase() === lower) ? [nameProblem("a source with this name already exists")] : [];
}

/** Places a problem beside the name field. */
function nameProblem(message: string): Problem {
    return { field: NAME_FIELD, entry: null, message };
}

/** Places each of a module's field rule failures beside the field it names, in zod's own words. */
function fieldProblems(error: z.ZodError): Problem[] {
    return error.issues.map((issue) => ({ field: typeof issue.path[0] === "string" ? issue.path[0] : null, entry: null, message: issue.message }));
}

/** Finds the problems a source makes with the others: one already saved for the same board or search, or a search the JSearch budget can't fit. */
function sourceProblems(source: NewSource, others: SavedSource[], limits: SearchLimits): Problem[] {
    const same = others.find((other) => other.target === source.target);
    const repeat = same === undefined ? [] : [{ field: null, entry: null, message: `this board is already saved as ${same.name}` }];
    const overBudget = source.enabled && isScheduled(source.module) && !fitsBudget(scheduledOn(others), limits);
    return overBudget ? [...repeat, { field: null, entry: null, message: OVER_BUDGET }] : repeat;
}

/** Reports whether a module is fetched on JSearch's schedule, spending the monthly budget. */
export function isScheduled(module: string): boolean {
    return moduleFor(module)?.limits.refresh === "jsearch_refresh_hours";
}

/** Counts the scheduled searches that are on, plus the one being added or turned on. */
function scheduledOn(saved: SavedSource[]): number {
    return saved.filter((source) => source.enabled && isScheduled(source.module)).length + 1;
}

/** Reports whether this many scheduled searches, each fetched once per refresh interval, stay within the monthly request cap. */
function fitsBudget(searches: number, limits: SearchLimits): boolean {
    const refreshesPerMonth = Math.ceil(HOURS_PER_MONTH / (limits.refresh_hours - REFRESH_GRACE_HOURS));
    return searches * refreshesPerMonth <= limits.monthly_request_cap;
}
