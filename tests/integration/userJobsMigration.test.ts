import { sql, type Kysely } from "kysely";
import { expect, test } from "vitest";
import type { Database } from "../../src/db/schema.js";
import { columnTypes, migrateBefore, migrateUpTo, storedJob } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const SEEN = "2026-10-22T00:00:00.000Z";

type Step019 = {
    users: { id: number; name: string; created_at: string };
    user_sources: { id: number; user_id: number; module: string; name: string; params: string; target: string; enabled: number; created_at: string; updated_at: string };
    jobs: ReturnType<typeof storedJob> & { source_id: number | null; scored_at: string | null; score: number | null; reasons: string | null; gaps: string | null; hidden: number; applied: number; applied_on: string | null };
    verdicts: { ats: string; job_id: string; scored_at: string; score: number; reasons: string; gaps: string };
    rescore_runs: { id: string; ats: string; job_id: string; started_at: string };
    gmail_connection: { id: number; status: string };
    gmail_alert_state: { id: number; emails_read: number };
    user_jobs: { user_id: number; ats: string; job_id: string; source: string; source_id: number | null; score: number | null; hidden: number; applied: number; applied_on: string | null };
};

async function seed019(db: Kysely<Database>) {
    const step = (db as unknown as Kysely<unknown>).withTables<Step019>();
    await step.insertInto("users").values({ id: 1, name: "owner", created_at: SEEN }).execute();
    await step.insertInto("user_sources").values({ id: 7, user_id: 1, module: "greenhouse", name: "Acme", params: "{}", target: "greenhouse:acme", enabled: 1, created_at: SEEN, updated_at: SEEN }).execute();
    const job = (id: string, marks: Partial<Step019["jobs"]>) => ({ ...storedJob(id, null), source_id: 7, scored_at: null, score: null, reasons: null, gaps: null, hidden: 0, applied: 0, applied_on: null, ...marks });
    await step.insertInto("jobs").values([job("scored", { scored_at: SEEN, score: 80, reasons: "[]", gaps: "[]" }), job("hidden", { hidden: 1 }), job("applied", { applied: 1, applied_on: SEEN })]).execute();
    await step.insertInto("verdicts").values({ ats: "greenhouse", job_id: "scored", scored_at: SEEN, score: 80, reasons: "[]", gaps: "[]" }).execute();
    await step.insertInto("rescore_runs").values({ id: "run-1", ats: "greenhouse", job_id: "scored", started_at: SEEN }).execute();
    await step.insertInto("gmail_connection").values({ id: 1, status: "connected" }).execute();
    await step.insertInto("gmail_alert_state").values({ id: 1, emails_read: 4 }).execute();
    return step;
}

async function foreignKeys(db: Kysely<Database>, tables: string[]) {
    const query = sql<{ TABLE_NAME: string; COLUMN_NAME: string; REFERENCED_TABLE_NAME: string }>`SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${sql.join(tables)}) AND REFERENCED_TABLE_NAME IS NOT NULL`;
    return (await query.execute(db)).rows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}>${row.REFERENCED_TABLE_NAME}`).sort();
}

async function indexNames(db: Kysely<Database>, table: string) {
    const query = sql<{ INDEX_NAME: string }>`SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}`;
    return (await query.execute(db)).rows.map((row) => row.INDEX_NAME).sort();
}

async function migratedFrom019<T>(check: (db: Kysely<Database>, step: Awaited<ReturnType<typeof seed019>>) => Promise<T>) {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "020");
        await check(db, await seed019(db));
    } finally {
        await db.destroy();
    }
}

test("step 020 copies every job's per-user columns to user 1's view of it", () =>
    migratedFrom019(async (db, step) => {
        expect(await migrateUpTo(db, "021")).toEqual(["020_user_jobs"]);
        const views = await step.selectFrom("user_jobs").select(["user_id", "job_id", "source", "source_id", "score", "hidden", "applied", "applied_on"]).orderBy("job_id").execute();
        expect(views).toEqual([
            { user_id: 1, job_id: "applied", source: "Acme", source_id: 7, score: null, hidden: 0, applied: 1, applied_on: SEEN },
            { user_id: 1, job_id: "hidden", source: "Acme", source_id: 7, score: null, hidden: 1, applied: 0, applied_on: null },
            { user_id: 1, job_id: "scored", source: "Acme", source_id: 7, score: 80, hidden: 0, applied: 0, applied_on: null },
        ]);
        expect(await indexNames(db, "user_jobs")).toEqual(expect.arrayContaining(["PRIMARY", "user_jobs_scored", "user_jobs_applied", "user_jobs_seen"]));
    }), 120_000);

test("steps 021 to 023 give verdicts, re-score runs and Gmail to user 1, then drop the moved columns, key and indexes from postings", () =>
    migratedFrom019(async (db) => {
        expect(await migrateUpTo(db, "024")).toEqual(["020_user_jobs", "021_history_owners", "022_gmail_by_user", "023_jobs_without_user_columns"]);
        expect(await columnTypes(db, "jobs", ["source_id", "scored_at", "score", "base_score", "bonus_score", "reasons", "gaps", "hidden", "applied", "applied_on"])).toEqual([]);
        expect(await columnTypes(db, "jobs", ["first_seen", "last_seen", "source", "description", "company_id", "injection_seen_at", "emailed_at"])).toHaveLength(7);
        expect((await indexNames(db, "jobs")).filter((name) => name === "jobs_source" || name === "jobs_by_source")).toEqual([]);
        expect([await columnTypes(db, "verdicts", ["user_id"]), await columnTypes(db, "gmail_connection", ["user_id"])]).toEqual([["user_id int(11) NO  "], ["user_id int(11) NO  "]]);
        expect(await foreignKeys(db, ["user_jobs", "verdicts", "rescore_runs", "gmail_connection", "gmail_alert_state"])).toEqual(["gmail_alert_state.user_id>users", "gmail_connection.user_id>users", "rescore_runs.user_id>users", "user_jobs.ats>jobs", "user_jobs.job_id>jobs", "user_jobs.source_id>user_sources", "user_jobs.user_id>users", "verdicts.user_id>users"]);
        const owners = await sql<{ owner: number }>`SELECT user_id AS owner FROM verdicts UNION ALL SELECT user_id FROM rescore_runs UNION ALL SELECT user_id FROM gmail_connection UNION ALL SELECT user_id FROM gmail_alert_state`.execute(db);
        expect(owners.rows.map((row) => row.owner)).toEqual([1, 1, 1, 1]);
    }), 120_000);
