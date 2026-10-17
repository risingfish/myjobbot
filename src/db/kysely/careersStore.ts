import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { AuditEntry, CareersPageRow, CareersStore, JobKey, RememberedPage } from "../store.js";

const MAX_DETAIL = 2000;
const RETRYABLE_REASONS = ["lookup_error", "search_unavailable"];

export class KyselyCareersStore implements CareersStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns the careers page remembered for a company, or null when none is. */
    async rememberedPage(companyKey: string): Promise<CareersPageRow | null> {
        return (await this.db.selectFrom("careers_pages").selectAll().where("company_key", "=", companyKey).executeTakeFirst()) ?? null;
    }

    /** Remembers the careers page that led to a found job, replacing any page remembered for that company. */
    async rememberPage(page: RememberedPage, at: string): Promise<void> {
        const values = { company: page.company, url: page.url, found_at: at, last_used_at: at };
        await this.db
            .insertInto("careers_pages")
            .values({ company_key: page.companyKey, ...values })
            .onDuplicateKeyUpdate(values)
            .execute();
    }

    /** Records that a remembered careers page was offered to a lookup. */
    async usePage(companyKey: string, at: string): Promise<void> {
        await this.db.updateTable("careers_pages").set({ last_used_at: at }).where("company_key", "=", companyKey).execute();
    }

    /** Forgets a company's careers page once it stops working. */
    async forgetPage(companyKey: string): Promise<void> {
        await this.db.deleteFrom("careers_pages").where("company_key", "=", companyKey).execute();
    }

    /** Appends one step of a careers lookup to the audit log, keeping only addresses and counts, never page text. */
    async audit(entry: AuditEntry): Promise<void> {
        await this.db.insertInto("careers_audit").values(auditRow(entry)).execute();
    }

    /** Returns the jobs whose lookup already ended for good, so a run doesn't look them up again. */
    async attempted(keys: JobKey[]): Promise<JobKey[]> {
        if (keys.length === 0) return [];
        const rows = await this.db
            .selectFrom("careers_audit")
            .select(["ats", "job_id"])
            .distinct()
            .where("step", "=", "finish")
            .where((eb) => eb.or([eb("reason", "is", null), eb("reason", "not in", RETRYABLE_REASONS)]))
            .where(
                "job_id",
                "in",
                keys.map((key) => key.jobId),
            )
            .execute();
        return keys.filter((key) => rows.some((row) => row.ats === key.ats && row.job_id === key.jobId));
    }

    /** Deletes audit rows older than the retention cutoff. */
    async pruneAuditBefore(cutoff: string): Promise<void> {
        await this.db.deleteFrom("careers_audit").where("at", "<", cutoff).execute();
    }
}

/** Maps an audit entry to its stored row, with flags as 0/1, how the page was read, and the detail capped. */
function auditRow(entry: AuditEntry) {
    const flag = (value: boolean | undefined) => (value === true ? 1 : 0);
    const where = { run_id: entry.runId, at: entry.at, ats: entry.ats, job_id: entry.jobId, company: entry.company, step: entry.step, url: entry.url };
    const what = { chars: entry.chars ?? null, cut: flag(entry.cut), more_pages: flag(entry.morePages), outcome: entry.outcome, reason: entry.reason, warning: flag(entry.warning) };
    const read = { page_source: entry.pageSource ?? null, fallback: entry.fallback ?? null, board: entry.board ?? null };
    return { ...where, ...what, ...read, detail: entry.detail?.slice(0, MAX_DETAIL) ?? null };
}
