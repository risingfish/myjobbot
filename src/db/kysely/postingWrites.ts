import { sql, type ExpressionBuilder, type Transaction } from "kysely";
import { normalizeCompany } from "../../jobs/company.js";
import type { Job } from "../../jobs/job.js";
import { sourceParts, type JobSource } from "../jobSource.js";
import { toParams, type JobFields } from "../rows.js";
import type { Database } from "../schema.js";
import type { JobKey } from "../store.js";

const REFRESHED: Array<keyof JobFields | "company_id"> = ["company_id", "company", "title", "normalized_title", "location", "department", "team", "workplace_type", "is_remote", "compensation", "url", "posted_at", "publisher", "requirements", "skills", "preferred_skills"];

const DESCRIBED: Array<keyof JobFields> = ["description", "description_format", "description_source", "description_url"];

export interface PostingBatch {
    jobs: Job[];
    seen: string;
    source: JobSource;
    companyIds: Map<string, number>;
}

/** Keeps a posting's description when a refresh brings none, so a found description is never lost; otherwise takes the new one. */
function keptUnlessNew(eb: ExpressionBuilder<Database, "jobs">, column: keyof JobFields) {
    return eb.case().when(sql`VALUES(description)`, "is", null).then(eb.ref(column)).else(sql`VALUES(${sql.ref(column)})`).end();
}

/** Inserts or refreshes the postings of a fetch, first and last seen at the fetch time and linked to their companies, keeping a description already found when the refresh has none. */
export async function upsertPostings(trx: Transaction<Database>, batch: PostingBatch): Promise<void> {
    const { label } = sourceParts(batch.source);
    const rows = batch.jobs.map((job) => {
        const { seen: _seen, ...fields } = toParams(job, batch.seen, label);
        return { ...fields, company_id: batch.companyIds.get(normalizeCompany(job.company)) ?? null, first_seen: batch.seen, last_seen: batch.seen };
    });
    await trx
        .insertInto("jobs")
        .values(rows)
        .onDuplicateKeyUpdate((eb) => ({
            ...Object.fromEntries([...REFRESHED, "last_seen"].map((column) => [column, sql`VALUES(${sql.ref(column)})`])),
            ...Object.fromEntries(DESCRIBED.map((column) => [column, keptUnlessNew(eb, column)])),
        }))
        .execute();
}

/** Lists the stored postings among a fetch's jobs whose description was plain text or had no format, so their scores can be cleared if it now becomes Markdown. */
export async function plainPostings(trx: Transaction<Database>, jobs: Job[]): Promise<Set<string>> {
    const ids = jobs.map((job) => job.jobId);
    if (ids.length === 0) return new Set();
    const rows = await trx.selectFrom("jobs").select(["ats", "job_id"]).where("job_id", "in", ids).where((eb) => eb.or([eb("description_format", "=", "text"), eb("description_format", "is", null)])).forUpdate().execute();
    return new Set(rows.map((row) => keyOf({ ats: row.ats, jobId: row.job_id })));
}

/** Names a posting's key as one string, for sets of keys. */
export function keyOf(key: JobKey): string {
    return `${key.ats}\u0000${key.jobId}`;
}
