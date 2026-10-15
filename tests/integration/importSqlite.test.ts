import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import { importSqlite } from "../../src/app/importSqlite.js";
import type { Database } from "../../src/db/schema.js";
import { sqliteFixture } from "../helpers/sqliteFixture.js";
import { connectTestDb, emptyTables, testSettings } from "../helpers/testDb.js";

let db: Kysely<Database>;

beforeAll(async () => {
    db = await connectTestDb();
});

afterAll(async () => {
    if (db) await db.destroy();
});

async function jobCount(): Promise<number> {
    const row = await db
        .selectFrom("jobs")
        .select((eb) => eb.fn.countAll().as("count"))
        .executeTakeFirstOrThrow();
    return Number(row.count);
}

test("a copy brings every row across, keeping verdict order and exact text", async () => {
    await emptyTables(db);
    expect(await importSqlite(sqliteFixture({ jobs: 120 }), testSettings())).toEqual({ jobs: 120, verdicts: 120, api_calls: 1, hidden: 40 });
    const verdictIds = await db.selectFrom("verdicts").select("id").orderBy("id").execute();
    expect(verdictIds.map((row) => row.id)).toEqual(Array.from({ length: 120 }, (_, index) => index + 1));
    const job = await db.selectFrom("jobs").selectAll().where("job_id", "=", "job-7").executeTakeFirstOrThrow();
    expect(job).toMatchObject({ description: "Zürich C++ 🚀", score: 80, first_seen: "2026-10-01T00:00:00.000Z", hidden: 0, is_remote: 1 });
});

test("a second copy into a database that already has rows is refused and changes nothing", async () => {
    await emptyTables(db);
    await importSqlite(sqliteFixture({ jobs: 3 }), testSettings());
    await expect(importSqlite(sqliteFixture({ jobs: 5 }), testSettings())).rejects.toThrow("target is not empty");
    expect(await jobCount()).toBe(3);
});

test("a value too long for its column stops the copy before anything is written", async () => {
    await emptyTables(db);
    await expect(importSqlite(sqliteFixture({ jobs: 3, longTitle: true }), testSettings())).rejects.toThrow("jobs.title (600 > 500)");
    expect(await jobCount()).toBe(0);
});
