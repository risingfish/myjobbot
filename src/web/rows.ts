import type { FileConfig } from "../config/schema.js";
import type { JobView, VerdictView } from "../db/jobViews.js";
import { daysBetween } from "../jobs/age.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import { boostedScore, jobBoost, type Boost } from "../jobs/titleBoost.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { bulletList, cells, dateOnly, escapeHtml, linkTo } from "./html.js";

export interface RowContext {
  now: Date;
  ghostDays: number;
  titleFilter: FileConfig["title_filter"];
  boosts: FileConfig["title_boosts"];
  excludedCompanies: FileConfig["exclude_companies"];
  back: string;
}

const HIDDEN_NOTE = ' <small class="note hidden-note">hidden by you</small>';

/** Renders a table row for a job listing, including score, title, hide controls and reasoning. */
export function jobRow(job: JobView, context: RowContext): string {
  const title = `${linkTo(job.url, job.title)}${filterNote(job, context)}${HIDDEN_NOTE}${reasoning(job)}`;
  return `<tr class="job" data-hidden="${Number(job.hidden)}">${cells([
    jobScore(job, context), title, escapeHtml(job.company), escapeHtml(job.location), remoteText(job.is_remote),
    sourceText(job), postedText(job, context), escapeHtml(dateOnly(job.scored_at)), hideButton(job, context.back),
  ])}</tr>`;
}

/** Renders a table row for one scoring-history verdict. */
export function verdictRow(verdict: VerdictView): string {
  const run = verdict.run_id ? escapeHtml(verdict.run_id.slice(0, 8)) : "<small>before history</small>";
  return `<tr class="verdict">${cells([
    escapeHtml(verdict.scored_at.slice(0, 16).replace("T", " ")), run, linkTo(verdict.url, verdict.title ?? "(pruned)"),
    escapeHtml(verdict.company), withNote(scoreText(verdict.score), breakdown(verdict)), bulletList(verdict.reasons), bulletList(verdict.gaps),
  ])}</tr>`;
}

/** Renders a numeric score as a styled span, or an empty string when there is no score. */
function scoreText(score: number | null): string {
  return score === null ? "" : `<span class="score">${score}</span>`;
}

/** Renders a job's boosted score together with its scoring and boost breakdown as a note. */
function jobScore(job: JobView, context: RowContext): string {
  if (job.score === null) return "";
  const boost = jobBoost([job.title, job.description], context.boosts);
  const notes = [breakdown(job), boostNote(job.score, boost)].filter((note) => note !== "");
  return withNote(scoreText(boostedScore(job.score, boost)), notes.join(" · "));
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

/** Appends a small note below the given HTML, or returns the HTML unchanged when there is no note. */
function withNote(html: string, note: string): string {
  return note === "" ? html : `${html}<br><small>${escapeHtml(note)}</small>`;
}

/** Renders the hide/unhide form button for a job, preserving the current tab to return to. */
function hideButton(job: JobView, back: string): string {
  const fields = { ats: job.ats, job_id: job.job_id, hidden: job.hidden ? "0" : "1", back };
  const inputs = Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`);
  return `<form method="post" action="/hide" class="hide">${inputs.join("")}<button>${job.hidden ? "Unhide" : "Hide"}</button></form>`;
}

/** Returns "yes", "no", or an empty string for a job's remote status. */
function remoteText(isRemote: number | null): string {
  if (isRemote === null) return "";
  return isRemote === 1 ? "yes" : "no";
}

/** Renders the job's source, with the publisher noted underneath when known. */
function sourceText(job: JobView): string {
  const via = job.publisher ? `<br><small>via ${escapeHtml(job.publisher)}</small>` : "";
  return `${escapeHtml(job.source)}${via}`;
}

/** Renders when a job was opened, how many days it has been open, and a ghost-listing warning if stale. */
function postedText(job: JobView, context: RowContext): string {
  const opened = job.posted_at && job.posted_at < job.first_seen ? job.posted_at : job.first_seen;
  const days = daysBetween(opened, context.now);
  const ghost = days > context.ghostDays ? ' <span class="ghost">⚠ possible ghost</span>' : "";
  return `${escapeHtml(dateOnly(opened))}<br><small>${days} days open</small>${ghost}`;
}

/** Renders a note explaining why a job would be excluded, by company or title filter, if applicable. */
function filterNote(job: JobView, context: RowContext): string {
  if (isExcludedCompany(job.company, context.excludedCompanies)) return ' <small class="note">hidden: excluded company</small>';
  return passesTitleFilter(job.title, context.titleFilter) ? "" : ' <small class="note">hidden by title filter</small>';
}

/** Renders a collapsible breakdown of the scoring reasons and gaps for a job, when there are any. */
function reasoning(job: JobView): string {
  if (job.reasons.length + job.gaps.length === 0) return "";
  return `<details><summary>Why</summary>${labelled("Reasons", job.reasons)}${labelled("Gaps", job.gaps)}</details>`;
}

/** Renders a labelled bullet list section, or an empty string when the list is empty. */
function labelled(label: string, items: string[]): string {
  return items.length === 0 ? "" : `<strong>${label}</strong>${bulletList(items)}`;
}
