import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { AuditEntry, CareersStore, CompanyPage, JobKey } from "../store.js";
import { ensureCompany } from "./companyRows.js";

const MAX_DETAIL = 2000;
const RETRYABLE_REASONS = ["lookup_error", "search_unavailable"];

export class KyselyCareersStore implements CareersStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns the careers page on a company's record, or null when it has none. */
    async careersPage(companyKey: string): Promise<string | null> {
        const row = await this.db.selectFrom("companies").select("careers_url").where("company_key", "=", companyKey).executeTakeFirst();
        return row?.careers_url ?? null;
    }

    /** Keeps the careers page that led to a found job on its company's record, unless the company's careers page is its configured board. */
    async setLookupPage(page: CompanyPage, at: string): Promise<void> {
        await ensureCompany(this.db, page, at);
        await this.db
            .updateTable("companies")
            .set({ careers_url: page.url, careers_source: "lookup", careers_reason: null, careers_rejected: null })
            .where("company_key", "=", page.key)
            .where((eb) => eb.or([eb("careers_source", "is", null), eb("careers_source", "<>", "board")]))
            .execute();
    }

    /** Clears a company's careers page once it stops working, keeping it among the turned-down addresses so a search never stores it again; a board page is never cleared. */
    async clearLookupPage(companyKey: string): Promise<void> {
        const row = await this.db.selectFrom("companies").select(["careers_url", "careers_rejected"]).where("company_key", "=", companyKey).where("careers_source", "in", ["lookup", "search"]).executeTakeFirst();
        if (row === undefined || row.careers_url === null) return;
        const rejected = JSON.stringify([...parseRejected(row.careers_rejected), row.careers_url]);
        await this.db
            .updateTable("companies")
            .set({ careers_url: null, careers_source: null, careers_rejected: rejected })
            .where("company_key", "=", companyKey)
            .where("careers_url", "=", row.careers_url)
            .where("careers_source", "in", ["lookup", "search"])
            .execute();
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
            .where("retry_once", "=", 0)
            .where((eb) => eb.or([eb("reason", "is", null), eb("reason", "not in", RETRYABLE_REASONS)]))
            .where(
                "job_id",
                "in",
                keys.map((key) => key.jobId),
            )
            .execute();
        return keys.filter((key) => rows.some((row) => row.ats === key.ats && row.job_id === key.jobId));
    }

    /** Returns the jobs still owed the one retry their earlier unreadable lookup earned, oldest mark first. */
    async retries(): Promise<JobKey[]> {
        const rows = await this.db
            .selectFrom("careers_audit as marked")
            .select(["marked.ats", "marked.job_id"])
            .where("marked.step", "=", "finish")
            .where("marked.retry_once", "=", 1)
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom("careers_audit as later").select("later.id").whereRef("later.ats", "=", "marked.ats").whereRef("later.job_id", "=", "marked.job_id").where("later.step", "=", "finish").whereRef("later.id", ">", "marked.id").where((eb) => eb.or([eb("later.reason", "is", null), eb("later.reason", "not in", RETRYABLE_REASONS)])))))
            .orderBy("marked.id")
            .execute();
        return rows.map((row) => ({ ats: row.ats, jobId: row.job_id }));
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

/** Reads a stored list of turned-down addresses, empty when there is none. */
function parseRejected(stored: string | null): string[] {
    return stored === null ? [] : (JSON.parse(stored) as string[]);
}
