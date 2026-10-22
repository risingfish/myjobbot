import type { JobDetailRow } from "../db/store.js";
import type { DescriptionDetail, DescriptionOrigin, JobDetailView, JobRowView, ScoreDetail } from "./api.js";
import { boostText, minutes, scoreBoost, toJobRowView, webUrl, type RowContext } from "./rowViews.js";

/** Converts one stored job into the details its panel shows. */
export function toJobDetailView(row: JobDetailRow, context: RowContext): JobDetailView {
    const job = toJobRowView(row, context);
    const terms = { pay: row.compensation, workplace: row.workplace_type };
    return { job: { ...job, ...terms }, score: scoreDetail(row, job, context), description: descriptionDetail(row) };
}

/** Explains a scored job's score: the total the table shows, the model's own score, the boost and the parts and notes behind it. */
function scoreDetail(row: JobDetailRow, job: JobRowView, context: RowContext): ScoreDetail | null {
    if (row.score === null || job.score === null) return null;
    const parts = { base: row.base_score, bonus: row.bonus_score, reasons: row.reasons, gaps: row.gaps };
    const scoredAt = row.scored_at === null ? null : minutes(row.scored_at);
    return { total: job.score.value, model: row.score, boost: boostText(scoreBoost(row, context)), ...parts, scoredAt };
}

/** Gathers the job's description with its requirements and skills, and where the description came from. */
function descriptionDetail(row: JobDetailRow): DescriptionDetail {
    const lists = { requirements: row.requirements, skills: row.skills, preferredSkills: row.preferred_skills };
    return { text: row.description, ...lists, origin: descriptionOrigin(row) };
}

/** Says whether the description came from the job's own listing or a careers page, linking that page only when it is a web address. */
function descriptionOrigin(row: JobDetailRow): DescriptionOrigin | null {
    if (row.description === null) return null;
    return row.description_source === "careers" ? { kind: "careers", url: webUrl(row.description_url) } : { kind: "source" };
}
