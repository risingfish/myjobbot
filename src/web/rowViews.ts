import type { FileConfig } from "../config/schema.js";
import type { JobView, VerdictView } from "../db/store.js";
import { daysBetween } from "../jobs/age.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import { boostedScore, jobBoost, type Boost } from "../jobs/titleBoost.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import type { JobRowView, Score, VerdictRowView } from "./api.js";

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
        url: webUrl(job.url),
        company: job.company,
        location: job.location ?? "",
        remote: remoteText(job.is_remote),
        source: job.source,
        via: job.publisher,
        posted: posted(job, context),
        scoredDate: dateOnly(job.scored_at),
        score: jobScore(job, context),
        filterNote: filterNote(job, context),
        hidden: job.hidden,
        reasons: job.reasons,
        gaps: job.gaps,
    };
}

/** Converts a stored scoring verdict into the ready-to-display row of the reasoning history. */
export function toVerdictRowView(verdict: VerdictView): VerdictRowView {
    return {
        key: String(verdict.id),
        scoredAt: verdict.scored_at.slice(0, 16).replace("T", " "),
        run: verdict.run_id ? verdict.run_id.slice(0, 8) : null,
        title: verdict.title ?? "(pruned)",
        url: webUrl(verdict.url),
        company: verdict.company ?? "",
        score: { value: verdict.score, note: breakdown(verdict) },
        reasons: verdict.reasons,
        gaps: verdict.gaps,
    };
}

/** Returns the date-only portion of an ISO timestamp, or an empty string when null. */
function dateOnly(iso: string | null): string {
    return iso ? iso.slice(0, 10) : "";
}

/** Returns the URL only when it is http(s), so unsafe link schemes never become links. */
function webUrl(url: string | null): string | null {
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
    const boost = jobBoost([job.title, job.description], context.boosts);
    const notes = [breakdown(job), boostNote(job.score, boost)].filter((note) => note !== "");
    return { value: boostedScore(job.score, boost), note: notes.join(" · ") };
}

/** Formats the base-plus-bonus score breakdown, or an empty string when either part is missing. */
function breakdown(parts: { base_score: number | null; bonus_score: number | null }): string {
    if (parts.base_score === null || parts.bonus_score === null) return "";
    return `base ${parts.base_score} + bonus ${parts.bonus_score}`;
}

/** Formats a note naming the model's score and the boost terms that raised it, or an empty string when none did. */
function boostNote(score: number, boost: Boost): string {
    return boost.points === 0 ? "" : `model ${score} · +${boost.points} ${boost.terms.join(", ")}`;
}

/** Explains why a job would be hidden from the model, by company or title filter, or null when it is not. */
function filterNote(job: JobView, context: RowContext): string | null {
    if (isExcludedCompany(job.company, context.excludedCompanies)) return "hidden: excluded company";
    return passesTitleFilter(job.title, context.titleFilter) ? null : "hidden by title filter";
}
