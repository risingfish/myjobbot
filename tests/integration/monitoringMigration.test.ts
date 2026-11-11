import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import type { Database } from "../../src/db/schema.js";
import { columnTypes, migrateBefore, migrateUpTo } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const AT = "2026-11-10T10:00:00.000Z";

async function migratedWithUser(check: (db: Kysely<Database>) => Promise<void>): Promise<void> {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "026");
        await db.insertInto("users").values({ id: 7, name: "seven", created_at: AT }).execute();
        await db.insertInto("rescore_runs").values({ id: "r1", user_id: 7, ats: "greenhouse", job_id: "1", started_at: AT }).execute();
        expect(await migrateUpTo(db, "027")).toEqual(["026_monitoring"]);
        await check(db);
    } finally {
        await db.destroy();
    }
}

test("step 026 adds the run, run part, fetch and mail tables, and the re-scores' model use at 0", () =>
    migratedWithUser(async (db) => {
        expect(await columnTypes(db, "agent_runs", ["id", "alive_at", "ended_at", "incomplete", "users", "completion_tokens"])).toEqual(["alive_at varchar(32) NO  utf8mb4_bin", "completion_tokens int(11) NO 0 ", "ended_at varchar(32) YES NULL utf8mb4_bin", "id varchar(36) NO  utf8mb4_bin", "incomplete tinyint(4) NO 0 ", "users int(11) NO 0 "]);
        expect(await columnTypes(db, "run_users", ["part_id", "ended_at", "outcome", "search_failures"])).toEqual(["ended_at varchar(32) YES NULL utf8mb4_bin", "outcome varchar(32) NO  utf8mb4_bin", "part_id varchar(36) YES NULL utf8mb4_bin", "search_failures int(11) NO 0 "]);
        expect(await columnTypes(db, "source_fetches", ["module", "ms", "reason"])).toEqual(["module varchar(64) NO  utf8mb4_bin", "ms int(11) NO  ", "reason varchar(64) YES NULL utf8mb4_bin"]);
        expect(await columnTypes(db, "mail_sends", ["kind", "outcome"])).toEqual(["kind varchar(32) NO  utf8mb4_bin", "outcome varchar(8) NO  utf8mb4_bin"]);
        expect(await db.selectFrom("rescore_runs").select(["model_calls", "prompt_tokens", "completion_tokens"]).executeTakeFirstOrThrow()).toEqual({ model_calls: 0, prompt_tokens: 0, completion_tokens: 0 });
    }), 120_000);

test("step 026's fetches go with their source, and a run's parts with their run", () =>
    migratedWithUser(async (db) => {
        await db.insertInto("agent_runs").values({ id: "run", started_at: AT, alive_at: AT }).execute();
        await db.insertInto("run_users").values({ run_id: "run", user_id: 7, started_at: AT, outcome: "running" }).execute();
        const source = await db.insertInto("user_sources").values({ user_id: 7, module: "greenhouse", name: "Acme", params: "{}", target: "greenhouse:acme", enabled: 1, created_at: AT, updated_at: AT }).executeTakeFirstOrThrow();
        await db.insertInto("source_fetches").values({ user_id: 7, source_id: Number(source.insertId), part_id: "p", module: "greenhouse", at: AT, ms: 5, outcome: "ok" }).execute();
        await db.deleteFrom("user_sources").execute();
        await db.deleteFrom("agent_runs").execute();
        expect([await db.selectFrom("source_fetches").selectAll().execute(), await db.selectFrom("run_users").selectAll().execute()]).toEqual([[], []]);
    }), 120_000);
