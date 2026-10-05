import type { FileConfig } from "../config/schema.js";
import type { JobView, VerdictView } from "../db/jobViews.js";
import { daysBetween } from "../jobs/age.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import { boostedScore, titleBoost } from "../jobs/titleBoost.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { bulletList, cells, dateOnly, escapeHtml, linkTo } from "./html.js";

export interface RowContext {
  now: Date;
  ghostDays: number;
  titleFilter: FileConfig["title_filter"];
  boosts: FileConfig["title_boosts"];
  excludedCompanies: FileConfig["exclude_companies"];
}

export function jobRow(job: JobView, context: RowContext): string {
  const title = `${linkTo(job.url, job.title)}${filterNote(job, context)}${reasoning(job)}`;
  return `<tr class="job">${cells([
    jobScore(job, context), title, escapeHtml(job.company), escapeHtml(job.location),
    remoteText(job.is_remote), sourceText(job), postedText(job, context), escapeHtml(dateOnly(job.scored_at)),
  ])}</tr>`;
}

export function verdictRow(verdict: VerdictView): string {
  const run = verdict.run_id ? escapeHtml(verdict.run_id.slice(0, 8)) : "<small>before history</small>";
  return `<tr class="verdict">${cells([
    escapeHtml(verdict.scored_at.slice(0, 16).replace("T", " ")), run, linkTo(verdict.url, verdict.title ?? "(pruned)"),
    escapeHtml(verdict.company), scoreText(verdict.score), bulletList(verdict.reasons), bulletList(verdict.gaps),
  ])}</tr>`;
}

function scoreText(score: number | null): string {
  return score === null ? "" : `<span class="score">${score}</span>`;
}

function jobScore(job: JobView, context: RowContext): string {
  if (job.score === null) return "";
  const boost = titleBoost(job.title, context.boosts);
  if (boost.points === 0) return scoreText(job.score);
  const note = `model ${job.score} · +${boost.points} ${boost.terms.join(", ")}`;
  return `${scoreText(boostedScore(job.score, boost))}<br><small>${escapeHtml(note)}</small>`;
}

function remoteText(isRemote: number | null): string {
  if (isRemote === null) return "";
  return isRemote === 1 ? "yes" : "no";
}

function sourceText(job: JobView): string {
  const via = job.publisher ? `<br><small>via ${escapeHtml(job.publisher)}</small>` : "";
  return `${escapeHtml(job.source)}${via}`;
}

function postedText(job: JobView, context: RowContext): string {
  const opened = job.posted_at && job.posted_at < job.first_seen ? job.posted_at : job.first_seen;
  const days = daysBetween(opened, context.now);
  const ghost = days > context.ghostDays ? ' <span class="ghost">⚠ possible ghost</span>' : "";
  return `${escapeHtml(dateOnly(opened))}<br><small>${days} days open</small>${ghost}`;
}

function filterNote(job: JobView, context: RowContext): string {
  if (isExcludedCompany(job.company, context.excludedCompanies)) return ' <small class="note">hidden: excluded company</small>';
  return passesTitleFilter(job.title, context.titleFilter) ? "" : ' <small class="note">hidden by title filter</small>';
}

function reasoning(job: JobView): string {
  if (job.reasons.length + job.gaps.length === 0) return "";
  return `<details><summary>Why</summary>${labelled("Reasons", job.reasons)}${labelled("Gaps", job.gaps)}</details>`;
}

function labelled(label: string, items: string[]): string {
  return items.length === 0 ? "" : `<strong>${label}</strong>${bulletList(items)}`;
}
