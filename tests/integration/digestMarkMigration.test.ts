import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import type { Database } from "../../src/db/schema.js";
import { columnTypes, migrateBefore, migrateUpTo, storedJob } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const SEEN = "2026-11-09T00:00:00.000Z";

type Step023 = {
    jobs: ReturnType<typeof storedJob> & { emailed_at: string | null };
    user_jobs: { user_id: number; ats: string; job_id: string; source: string; first_seen: string; last_seen: string };
    verdicts: { user_id: number; ats: string; job_id: string; scored_at: string; score: number; reasons: string; gaps: string };
};

async function seed023(db: Kysely<Database>) {
    const step = (db as unknown as Kysely<unknown>).withTables<Step023>();
    await step.insertInto("jobs").values([{ ...storedJob("marked", null), emailed_at: SEEN }, { ...storedJob("plain", null), emailed_at: null }]).execute();
    await step.insertInto("user_jobs").values(["marked", "plain"].map((id) => ({ user_id: 1, ats: "greenhouse", job_id: id, source: "Acme", first_seen: SEEN, last_seen: SEEN }))).execute();
    await step.insertInto("verdicts").values({ user_id: 1, ats: "greenhouse", job_id: "plain", scored_at: SEEN, score: 70, reasons: "[]", gaps: "[]" }).execute();
    return step;
}

async function counts(step: Awaited<ReturnType<typeof seed023>>) {
    const count = async (table: "jobs" | "user_jobs" | "verdicts") => Number((await step.selectFrom(table).select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirstOrThrow()).n);
    return [await count("jobs"), await count("user_jobs"), await count("verdicts")];
}

test("step 024 refuses while a posting holds a digest mark, then drops the column once it is cleared, keeping every row", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "024");
        const step = await seed023(db);
        await expect(migrateUpTo(db, "025")).rejects.toThrow("schema step 024_jobs_without_digest_mark failed: 1 postings have an email-digest mark, which nothing should have written; restore or clear it before upgrading");
        expect(await columnTypes(db, "jobs", ["emailed_at"])).toHaveLength(1);
        await step.updateTable("jobs").set({ emailed_at: null }).execute();
        expect(await migrateUpTo(db, "025")).toEqual(["024_jobs_without_digest_mark"]);
        expect(await columnTypes(db, "jobs", ["emailed_at"])).toEqual([]);
        expect(await counts(step)).toEqual([2, 2, 1]);
    } finally {
        await db.destroy();
    }
}, 120_000);
