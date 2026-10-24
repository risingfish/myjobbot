import { sql, type Kysely } from "kysely";
import type { CompanyKey } from "../../companies/keys.js";
import type { Database } from "../schema.js";
import type { JobKey } from "../store.js";

interface UnlinkedRow {
    ats: string;
    job_id: string;
    company_key: string;
}

/** Records each company once, keeping its earliest created and latest found dates, and returns the record ids by company key. */
export async function recordCompanies(db: Kysely<Database>, keys: CompanyKey[]): Promise<Map<string, number>> {
    if (keys.length === 0) return new Map();
    await upsertCompanies(db, keys);
    return companyIds(
        db,
        keys.map((entry) => entry.key),
    );
}

/** Inserts a record for each new company and widens the dates of those already recorded. */
async function upsertCompanies(db: Kysely<Database>, keys: CompanyKey[]): Promise<void> {
    await db
        .insertInto("companies")
        .values(keys.map((entry) => ({ company_key: entry.key, name: entry.name, created_date: entry.firstSeen, last_found_date: entry.lastSeen })))
        .onDuplicateKeyUpdate((eb) => ({
            created_date: eb.fn<string>("LEAST", [eb.ref("created_date"), sql<string>`VALUES(created_date)`]),
            last_found_date: eb.fn<string>("GREATEST", [eb.ref("last_found_date"), sql<string>`VALUES(last_found_date)`]),
        }))
        .execute();
}

/** Reads the record ids of the given companies, by company key. */
async function companyIds(db: Kysely<Database>, keys: string[]): Promise<Map<string, number>> {
    const rows = await db.selectFrom("companies").select(["id", "company_key"]).where("company_key", "in", keys).execute();
    return new Map(rows.map((row) => [row.company_key, row.id]));
}

/** Moves the found date of a seen job's company forward, when the job is linked to one. */
export async function touchCompanyOf(db: Kysely<Database>, key: JobKey, seen: string): Promise<void> {
    await db
        .updateTable("companies")
        .set((eb) => ({ last_found_date: eb.fn<string>("GREATEST", [eb.ref("last_found_date"), eb.val(seen)]) }))
        .where("id", "in", (eb) => eb.selectFrom("jobs").select("company_id").where("ats", "=", key.ats).where("job_id", "=", key.jobId))
        .execute();
}

/** Links each unlinked job to its company's record, and returns how many were linked. */
export async function linkJobs(db: Kysely<Database>, rows: UnlinkedRow[], ids: Map<string, number>): Promise<number> {
    let linked = 0;
    for (const row of rows) {
        const id = ids.get(row.company_key);
        if (id === undefined) continue;
        await db.updateTable("jobs").set({ company_id: id }).where("ats", "=", row.ats).where("job_id", "=", row.job_id).execute();
        linked += 1;
    }
    return linked;
}
