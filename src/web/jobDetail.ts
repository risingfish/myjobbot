import type { JobDetailRow } from "../db/store.js";
import type { JobDetailView, JobRowView, ScoreDetail } from "./api.js";
import { boostText, minutes, scoreBoost, toJobRowView, type RowContext } from "./rowViews.js";

/** Converts one stored job into the details its panel shows. */
export function toJobDetailView(row: JobDetailRow, context: RowContext): JobDetailView {
    const job = toJobRowView(row, context);
    return { job: { ...job, pay: row.compensation, workplace: row.workplace_type }, score: scoreDetail(row, job, context) };
}

/** Explains a scored job's score: the total the table shows, the model's own score, the boost and the parts and notes behind it. */
function scoreDetail(row: JobDetailRow, job: JobRowView, context: RowContext): ScoreDetail | null {
    if (row.score === null || job.score === null) return null;
    const parts = { base: row.base_score, bonus: row.bonus_score, reasons: row.reasons, gaps: row.gaps };
    const scoredAt = row.scored_at === null ? null : minutes(row.scored_at);
    return { total: job.score.value, model: row.score, boost: boostText(scoreBoost(row, context)), ...parts, scoredAt };
}
