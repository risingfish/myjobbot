import { z } from "zod";
import { DESCRIPTION_FORMATS, type Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";
import { jsonList } from "./columns.js";

const text = z.string().nullable();
const count = z.number().nullable();
const format = z.enum(DESCRIPTION_FORMATS).nullable();

export const jobRowSchema = z.object({
    ats: z.string(),
    job_id: z.string(),
    company: z.string(),
    title: z.string(),
    normalized_title: z.string(),
    location: text,
    department: text,
    team: text,
    workplace_type: text,
    is_remote: count,
    compensation: text,
    url: z.string(),
    posted_at: text,
    first_seen: z.string(),
    last_seen: z.string(),
    scored_at: text,
    score: count,
    description: text,
    description_format: format,
    description_source: text,
    description_url: text,
    requirements: jsonList,
    skills: jsonList,
    preferred_skills: jsonList,
});

export const jobViewSchema = z.object({
    ats: z.string(),
    job_id: z.string(),
    source: z.string(),
    company: z.string(),
    title: z.string(),
    url: z.string(),
    location: text,
    workplace_type: text,
    is_remote: count,
    compensation: text,
    posted_at: text,
    first_seen: z.string(),
    last_seen: z.string(),
    publisher: text,
    score: count,
    reasons: jsonList,
    gaps: jsonList,
    scored_at: text,
    hidden: z.number().transform((flag) => flag === 1),
    description: text,
    description_format: format,
    injection_seen_at: text,
    base_score: count,
    bonus_score: count,
});

export const jobDetailSchema = jobViewSchema.extend({
    description_source: text,
    description_url: text,
    requirements: jsonList,
    skills: jsonList,
    preferred_skills: jsonList,
});

export const verdictViewSchema = z.object({
    id: z.number(),
    run_id: text,
    scored_at: z.string(),
    score: z.number(),
    base_score: count,
    bonus_score: count,
    reasons: jsonList,
    gaps: jsonList,
    title: text,
    company: text,
    url: text,
    source: text,
});

type Text = string | null;

type PostingFields = {
    ats: string;
    job_id: string;
    company: string;
    title: string;
    normalized_title: string;
    url: string;
    posted_at: Text;
    publisher: Text;
};

type DetailFields = {
    location: Text;
    department: Text;
    team: Text;
    workplace_type: Text;
    is_remote: number | null;
    compensation: Text;
    description: Text;
    description_format: Text;
    description_source: Text;
    description_url: Text;
    requirements: Text;
    skills: Text;
    preferred_skills: Text;
};

export type JobFields = PostingFields & DetailFields & { source: string };
export type JobParams = JobFields & { seen: string };

/** Maps a job and fetch metadata to the named parameters an upsert stores. */
export function toParams(job: Job, seen: string, source: string): JobParams {
    return { ...postingParams(job), ...detailParams(job), source, seen };
}

/** Maps the fields that identify a posting and where it lives to their stored values. */
function postingParams(job: Job): PostingFields {
    return {
        ats: job.ats,
        job_id: job.jobId,
        company: job.company,
        title: job.title,
        normalized_title: normalizeTitle(job.title),
        url: job.url,
        posted_at: job.postedAt,
        publisher: job.publisher,
    };
}

/** Maps the fields that describe the role itself to their stored values. */
function detailParams(job: Job): DetailFields {
    return {
        location: job.location,
        department: job.department,
        team: job.team,
        workplace_type: job.workplaceType,
        is_remote: toFlag(job.isRemote),
        compensation: job.compensation,
        description: job.description,
        description_format: job.description === null ? null : job.descriptionFormat,
        description_source: job.description === null ? null : "source",
        description_url: null,
        requirements: listParam(job.requirements),
        skills: listParam(job.skills),
        preferred_skills: listParam(job.preferredSkills),
    };
}

/** Encodes a string list as JSON for storage, or null when the list is empty. */
function listParam(items: string[]): string | null {
    return items.length === 0 ? null : JSON.stringify(items);
}

/** Converts a nullable boolean to the 0/1 encoding the is_remote column stores. */
function toFlag(value: boolean | null): number | null {
    return value === null ? null : Number(value);
}
