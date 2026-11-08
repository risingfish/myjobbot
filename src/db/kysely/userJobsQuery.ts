import type { ExpressionBuilder, Kysely, Transaction } from "kysely";
import { sourceParts, type JobSource } from "../jobSource.js";
import type { Database } from "../schema.js";

type Joined = Database & { j: Database["jobs"]; u: Database["user_jobs"] };

export const ROW_COLUMNS = ["j.ats", "j.job_id", "j.company", "j.title", "j.normalized_title", "j.location", "j.department", "j.team", "j.workplace_type", "j.is_remote", "j.compensation", "j.url", "j.posted_at", "u.first_seen", "u.last_seen", "u.scored_at", "u.score", "j.description", "j.description_format", "j.description_source", "j.description_url", "j.requirements", "j.skills", "j.preferred_skills"] as const;

export const VIEW_COLUMNS = ["j.ats", "j.job_id", "u.source", "j.company", "j.title", "j.url", "j.location", "j.workplace_type", "j.is_remote", "j.compensation", "j.posted_at", "u.first_seen", "u.last_seen", "j.publisher", "u.score", "u.reasons", "u.gaps", "u.scored_at", "u.hidden", "j.description", "j.description_format", "u.base_score", "u.bonus_score", "j.injection_seen_at", "u.applied", "u.applied_on"] as const;

/** Starts a query over the postings one user has, each joined with that user's view of it. */
export function userJobsOf(db: Kysely<Database> | Transaction<Database>, userId: number) {
    return db.selectFrom("jobs as j").innerJoin("user_jobs as u", (join) => join.onRef("u.ats", "=", "j.ats").onRef("u.job_id", "=", "j.job_id").on("u.user_id", "=", userId));
}

/** Narrows a user's postings to those one of their sources found: the saved source when it has one, otherwise its label. */
export function fromSource(eb: ExpressionBuilder<Joined, "j" | "u">, source: JobSource) {
    const { label, id } = sourceParts(source);
    return id === null ? eb("u.source", "=", label) : eb("u.source_id", "=", id);
}

/** Narrows a user's postings to those found by anything but one source. */
export function outsideSource(eb: ExpressionBuilder<Joined, "j" | "u">, source: JobSource) {
    const { label, id } = sourceParts(source);
    return id === null ? eb("u.source", "!=", label) : eb.or([eb("u.source_id", "is", null), eb("u.source_id", "!=", id)]);
}
