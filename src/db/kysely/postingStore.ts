import { sql, type Kysely } from "kysely";
import { z } from "zod";
import { companyKeys } from "../../companies/keys.js";
import { normalizeCompany } from "../../jobs/company.js";
import type { KnownPosting, PostingStore } from "../postingStore.js";
import type { Database } from "../schema.js";
import type { FoundDescription, JobKey } from "../store.js";
import { linkJobs, recordCompanies } from "./companyRows.js";
import { keyOf } from "./postingWrites.js";

export class KyselyPostingStore implements PostingStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Says which of these postings are stored, whoever found them, and whether each already has a description, so it isn't looked up again. */
    async known(keys: JobKey[]): Promise<KnownPosting[]> {
        if (keys.length === 0) return [];
        const rows = await this.db.selectFrom("jobs").select(["ats", "job_id", "description"]).where("job_id", "in", keys.map((key) => key.jobId)).execute();
        const asked = new Set(keys.map(keyOf));
        return rows.filter((row) => asked.has(keyOf({ ats: row.ats, jobId: row.job_id }))).map((row) => ({ ats: row.ats, jobId: row.job_id, described: row.description !== null }));
    }

    /** Stores a description found outside the posting's own source, with where it came from, and marks it for scoring again by every user who has it. */
    async setDescription(key: JobKey, found: FoundDescription): Promise<void> {
        const values = { description: found.description, description_format: found.format, description_source: found.source, description_url: found.url };
        await this.db.updateTable("jobs").set(values).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
        await this.db.updateTable("user_jobs").set({ scored_at: null }).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
    }

    /** Records when a posting's outside text was first found carrying a forged data marker, on every posting with that id, keeping the first time. */
    async flagInjection(jobId: string, at: string): Promise<void> {
        await this.db.updateTable("jobs").set({ injection_seen_at: at }).where("job_id", "=", jobId).where("injection_seen_at", "is", null).execute();
    }

    /** Links every posting without a company record to one, oldest first so each new record is named after its oldest posting, and returns how many were linked. */
    async linkUnlinkedJobs(): Promise<number> {
        const rows = await this.db.selectFrom("jobs").select(["ats", "job_id", "company", "first_seen", "last_seen"]).where("company_id", "is", null).orderBy("first_seen").orderBy("ats").orderBy("job_id").execute();
        const companyIds = await recordCompanies(this.db, companyKeys(rows.map((row) => ({ name: row.company, firstSeen: row.first_seen, lastSeen: row.last_seen }))));
        return linkJobs(
            this.db,
            rows.map((row) => ({ ats: row.ats, job_id: row.job_id, company_key: normalizeCompany(row.company) })),
            companyIds,
        );
    }

    /** Returns the oldest date a company's posting of a title was seen across reposts, so ghost detection counts its true age. */
    async earliestSeen(company: string, normalizedTitle: string): Promise<string> {
        const earliest = sql<string | null>`LEAST(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen)))`.as("earliest");
        const row = await this.db.selectFrom("jobs").select(earliest).where("company", "=", company).where("normalized_title", "=", normalizedTitle).executeTakeFirst();
        return z.object({ earliest: z.string() }).parse(row).earliest;
    }

    /** Drops each user's view of a job not seen since a cutoff, unless they applied to it, then their verdicts and re-score runs of it, then every posting no user has any more; returns how many postings went. */
    async prune(cutoff: string): Promise<number> {
        await this.db.deleteFrom("user_jobs").where("last_seen", "<", cutoff).where("applied", "=", 0).execute();
        await this.deleteViewless("verdicts");
        await this.deleteViewless("rescore_runs");
        const result = await this.db
            .deleteFrom("jobs")
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom("user_jobs").select(sql`1`.as("one")).whereRef("user_jobs.ats", "=", "jobs.ats").whereRef("user_jobs.job_id", "=", "jobs.job_id"))))
            .executeTakeFirst();
        return Number(result.numDeletedRows);
    }

    /** Deletes a user's verdicts or re-score runs of a job they no longer have. */
    private async deleteViewless(table: "verdicts" | "rescore_runs"): Promise<void> {
        await this.db
            .deleteFrom(table)
            .where(({ not, exists, selectFrom }) =>
                not(
                    exists(
                        selectFrom("user_jobs")
                            .select(sql`1`.as("one"))
                            .whereRef("user_jobs.user_id", "=", `${table}.user_id`)
                            .whereRef("user_jobs.ats", "=", `${table}.ats`)
                            .whereRef("user_jobs.job_id", "=", `${table}.job_id`),
                    ),
                ),
            )
            .execute();
    }
}
