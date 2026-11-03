import type { AppConfig } from "../config/load.js";
import type { JobKey, VerdictView } from "../db/store.js";
import { daysBetween } from "../jobs/age.js";
import { parseFile, type EvalCase, type Parsed, type Profile } from "./format.js";
import { caseId, contentId } from "./ids.js";
import type { Read } from "./observedRead.js";

interface DateInput {
    earliestSeen: string;
    capturedAt: string;
    scoredAt: string | null;
    ghostThresholdDays: number;
}

export interface AsScored {
    dates: EvalCase["dates"];
    possibleGhost: boolean;
}

export interface CaseInput {
    source: JobKey;
    title: string;
    company: string;
    payload: Record<string, unknown>;
    dates: AsScored;
    verdict: VerdictView | null;
    read: Read;
    descriptionFoundAt: string | null;
    profile: string;
    tags: string[];
}

/** Works out a job's age on the day of its score, counted in whole days from when it was first seen as a run counts it, and its age at capture. */
export function asScoredDates({ earliestSeen, capturedAt, scoredAt, ghostThresholdDays }: DateInput): AsScored {
    const atCapture = Math.max(0, daysBetween(earliestSeen, new Date(capturedAt)));
    const usable = scoredAt !== null && Date.parse(scoredAt) <= Date.parse(capturedAt);
    const asScored = usable ? Math.max(0, daysBetween(earliestSeen, new Date(scoredAt))) : atCapture;
    return { dates: { capturedAt, daysOpenAtCapture: atCapture, daysOpenAsScored: asScored, shiftedDays: atCapture - asScored }, possibleGhost: asScored > ghostThresholdDays };
}

/** Builds a job's case: the job as the model was given it on the day of its score, and that score, checked against the case format. */
export function buildCase(input: CaseInput): Parsed<EvalCase> {
    const { source, dates, verdict, descriptionFoundAt } = input;
    const job = { ...input.payload, days_open: dates.dates.daysOpenAsScored, possible_ghost: dates.possibleGhost };
    const changed = verdict !== null && descriptionFoundAt !== null && Date.parse(descriptionFoundAt) > Date.parse(verdict.scored_at);
    const observed = verdict === null ? null : observedOf(verdict, input.read);
    const raw = { schema: 1, id: caseId(source.ats, source.jobId), profile: input.profile, source, title: input.title, company: input.company, job, dates: dates.dates, observed, descriptionChangedSinceScored: changed, tags: input.tags };
    return parseFile("case", raw);
}

/** Gives the profile cases are captured against, named by its resume, preferences and thresholds. */
export function profileOf(config: AppConfig, capturedAt: string): { id: string; profile: Profile } {
    const fields = { resume: config.resume, preferences: config.settings.preferences, matchThreshold: config.settings.match_threshold, ghostThresholdDays: config.settings.ghost_threshold_days };
    return { id: contentId(fields), profile: { schema: 1, ...fields, capturedAt } };
}

/** Copies the score production gave the job, with how much of the job its model read. */
function observedOf(verdict: VerdictView, read: Read): EvalCase["observed"] {
    return { base: verdict.base_score, bonus: verdict.bonus_score, score: verdict.score, reasons: verdict.reasons, gaps: verdict.gaps, scoredAt: verdict.scored_at, runId: verdict.run_id, read };
}
