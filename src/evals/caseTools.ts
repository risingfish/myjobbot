import { z } from "zod";
import type { JobRow, JobStore, Verdict } from "../db/store.js";
import { recordMatchesTool } from "../tools/recordMatches.js";
import { defineTool, type Tool } from "../tools/tool.js";
import type { EvalCase } from "./format.js";
import type { Tally } from "./failure.js";

const NO_DESCRIPTION = "(none provided)";

export interface CaseStore extends Pick<JobStore, "findJob" | "recordVerdict"> {
    recorded(): Verdict | null;
}

/** Holds the one case a session scores: it finds only that job, keeps its verdict in memory, and writes nothing anywhere. */
export function caseStore(evalCase: EvalCase): CaseStore {
    let saved: Verdict | null = null;
    const row = rowOf(evalCase);
    return {
        findJob: async (jobId) => (jobId === row.job_id ? row : null),
        recordVerdict: async (verdict) => {
            if (verdict.job_id !== row.job_id) return false;
            saved = verdict;
            return true;
        },
        recorded: () => saved,
    };
}

/** Gives the model the case's two tools: get_job returning the frozen job, and record_matches saving its score, counting calls that fail. */
export function caseTools(evalCase: EvalCase, store: CaseStore, tally: Tally): Tool[] {
    const getJob = defineTool({
        name: "get_job",
        outsideText: true,
        description: "Return the job to re-score: its metadata, its description and, when the source provides them, requirements and skills.",
        schema: z.object({}),
        run: () => evalCase.job,
    });
    return [getJob, counted(recordMatchesTool({ store, now: () => new Date(evalCase.dates.capturedAt), runId: `eval-${evalCase.id}` }), tally)];
}

/** Wraps a tool so each call, and each call its arguments made fail, is counted. */
function counted(tool: Tool, tally: Tally): Tool {
    return {
        ...tool,
        invoke: async (raw) => {
            tally.calls += 1;
            try {
                return await tool.invoke(raw);
            } catch (error) {
                tally.failures += 1;
                throw error;
            }
        },
    };
}

/** Builds the stored row record_matches looks a job up by, from the case, so an alert-only job gets the same gap note as in a run. */
function rowOf(evalCase: EvalCase): JobRow {
    const { job, source } = evalCase;
    const at = evalCase.dates.capturedAt;
    const base = { ats: source.ats, job_id: job.job_id, company: evalCase.company, title: job.title, normalized_title: "", url: "", first_seen: at, last_seen: at, scored_at: null, score: null };
    return { ...base, ...optionalFields(job), ...descriptionFields(job.description), ...listFields(job) };
}

/** Copies the job's optional fields, absent ones as the null a stored row holds. */
function optionalFields(job: EvalCase["job"]) {
    const remote = job.is_remote === undefined ? null : Number(job.is_remote);
    return { location: orNull(job.location), department: orNull(job.department), team: orNull(job.team), workplace_type: orNull(job.workplace_type), compensation: orNull(job.compensation), posted_at: orNull(job.posted_at), is_remote: remote };
}

/** Gives the stored row's description, null when the case was captured without one. */
function descriptionFields(text: string | undefined) {
    const description = text === undefined || text === NO_DESCRIPTION ? null : text;
    return { description, description_format: description === null ? null : ("text" as const), description_source: null, description_url: null };
}

/** Copies the job's lists, absent ones as empty. */
function listFields(job: EvalCase["job"]) {
    return { requirements: job.requirements ?? [], skills: job.skills ?? [], preferred_skills: job.preferred_skills ?? [] };
}

/** Turns an absent value into null. */
function orNull<T>(value: T | undefined): T | null {
    return value === undefined ? null : value;
}
