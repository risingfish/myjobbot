import type { FileConfig } from "../config/schema.js";
import type { JobView, VerdictView } from "../db/store.js";
import { readableDescription } from "../descriptions/readable.js";
import { daysBetween } from "../jobs/age.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import { boostedScore, jobBoost, type Boost } from "../jobs/titleBoost.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import type { JobRowView, Score, VerdictRowView } from "./api.js";
import { shortTitle } from "./shortTitle.js";

export interface RowContext {
    now: Date;
    ghostDays: number;
    titleFilter: FileConfig["title_filter"];
    boosts: FileConfig["title_boosts"];
    excludedCompanies: FileConfig["exclude_companies"];
}

const WEB_URL = /^https?:\/\//i;

/** Converts a stored job into the ready-to-display row the web UI shows. */
export function toJobRowView(job: JobView, context: RowContext): JobRowView {
    return {
        ats: job.ats,
        jobId: job.job_id,
        title: job.title,
        shortTitle: shortTitle(job.title),
        url: webUrl(job.url),
        company: job.company,
        location: job.location ?? "",
        remote: remoteText(job.is_remote),
        source: job.source,
        via: job.publisher,
        posted: posted(job, context),
        score: jobScore(job, context),
        ...titleNotes(job, context),
        ...appliedMark(job),
        reasons: job.reasons,
        gaps: job.gaps,
    };
}

/** Works out the notes shown beside a job's title: why a filter hid it, whether its text tried to escape the data markers, and whether the owner hid it. */
function titleNotes(job: JobView, context: RowContext): Pick<JobRowView, "filterNote" | "injection" | "hidden"> {
    return { filterNote: filterNote(job, context), injection: job.injection_seen_at !== null, hidden: job.hidden };
}

/** Reports whether the owner has marked a job applied, and when. */
function appliedMark(job: JobView): Pick<JobRowView, "applied" | "appliedOn"> {
    return { applied: job.applied, appliedOn: job.applied_on };
}

/** Converts a stored scoring verdict into the ready-to-display row of the reasoning history. */
export function toVerdictRowView(verdict: VerdictView): VerdictRowView {
    return {
        key: String(verdict.id),
        scoredAt: minutes(verdict.scored_at),
        run: shortRun(verdict.run_id),
        title: verdict.title ?? "(pruned)",
        url: webUrl(verdict.url),
        company: verdict.company ?? "",
        score: { value: verdict.score, note: breakdown(verdict) },
        reasons: verdict.reasons,
        gaps: verdict.gaps,
    };
}

/** Shortens a run's id to the first eight characters the trace file names use, or null when the run isn't known. */
export function shortRun(runId: string | null): string | null {
    return runId ? runId.slice(0, 8) : null;
}

/** Shows an ISO timestamp to the minute, as "2026-10-02 09:30". */
export function minutes(iso: string): string {
    return iso.slice(0, 16).replace("T", " ");
}

/** Returns the date-only portion of an ISO timestamp, or an empty string when null. */
function dateOnly(iso: string | null): string {
    return iso ? iso.slice(0, 10) : "";
}

/** Returns the URL only when it is http(s), so unsafe link schemes never become links. */
export function webUrl(url: string | null): string | null {
    return url !== null && WEB_URL.test(url) ? url : null;
}

/** Returns "yes", "no", or an empty string for a job's remote status. */
function remoteText(isRemote: number | null): JobRowView["remote"] {
    if (isRemote === null) return "";
    return isRemote === 1 ? "yes" : "no";
}

/** Works out when a job was opened, how many days it has been open, and whether that looks like a ghost listing. */
function posted(job: JobView, context: RowContext): JobRowView["posted"] {
    const opened = job.posted_at && job.posted_at < job.first_seen ? job.posted_at : job.first_seen;
    const daysOpen = daysBetween(opened, context.now);
    return { date: dateOnly(opened), daysOpen, ghost: daysOpen > context.ghostDays };
}

/** Returns a job's boosted score with a note on its breakdown and boost, or null when unscored. */
function jobScore(job: JobView, context: RowContext): Score | null {
    if (job.score === null) return null;
    const boost = scoreBoost(job, context);
    const notes = [breakdown(job), boostNote(job.score, boost)].filter((note) => note !== "");
    return { value: boostedScore(job.score, boost), note: notes.join(" · ") };
}

/** Formats the base-plus-bonus score breakdown, or an empty string when either part is missing. */
function breakdown(parts: { base_score: number | null; bonus_score: number | null }): string {
    if (parts.base_score === null || parts.bonus_score === null) return "";
    return `base ${parts.base_score} + bonus ${parts.bonus_score}`;
}

/** Works out which title boost terms raise a job's score, and by how much. */
export function scoreBoost(job: JobView, context: RowContext): Boost {
    return jobBoost([job.title, readableDescription(job.description, job.description_format)], context.boosts);
}

/** Names the points a boost adds and the terms that earned them, as "+5 backend", or null when none did. */
export function boostText(boost: Boost): string | null {
    return boost.points === 0 ? null : `+${boost.points} ${boost.terms.join(", ")}`;
}

/** Formats a note naming the model's score and the boost terms that raised it, or an empty string when none did. */
function boostNote(score: number, boost: Boost): string {
    const text = boostText(boost);
    return text === null ? "" : `model ${score} · ${text}`;
}

/** Explains why a job would be hidden from the model, by company or title filter, or null when it is not. */
function filterNote(job: JobView, context: RowContext): string | null {
    if (isExcludedCompany(job.company, context.excludedCompanies)) return "hidden: excluded company";
    return passesTitleFilter(job.title, context.titleFilter) ? null : "hidden by title filter";
}
