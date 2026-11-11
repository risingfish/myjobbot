import type { Kysely, Selectable } from "kysely";
import { afterAll, beforeAll } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import type { FetchRecord } from "../../src/db/fetchHistory.js";
import type { MailSend } from "../../src/db/mailLog.js";
import type { Database } from "../../src/db/schema.js";
import type { AgentRunsTable, RunUsersTable } from "../../src/db/schema/monitoring.js";
import { withOwner } from "../helpers/memoryStore.js";
import { monitoringReadCases } from "../helpers/monitoringReadContract.js";
import { monitoringStrictCases, type MonitoringHooks } from "../helpers/monitoringContract.js";
import { connectTestDb, emptyTables, emptyWithOwner } from "../helpers/testDb.js";

let db: Kysely<Database>;

beforeAll(async () => {
    db = await connectTestDb();
});

afterAll(async () => {
    if (!db) return;
    await emptyTables(db);
    await db.destroy();
});

function tally(row: Selectable<RunUsersTable> | Selectable<AgentRunsTable>) {
    return { fetches: row.fetches, fetchFailures: row.fetch_failures, jobsFound: row.jobs_found, jobsScored: row.jobs_scored, searches: row.searches, searchFailures: row.search_failures, modelCalls: row.model_calls, promptTokens: row.prompt_tokens, completionTokens: row.completion_tokens };
}

const hooks = (): MonitoringHooks => ({
    run: async (runId) => {
        const row = await db.selectFrom("agent_runs").selectAll().where("id", "=", runId).executeTakeFirst();
        if (row === undefined) return null;
        const totals = row.ended_at === null ? null : { ...tally(row), users: row.users, usersFailed: row.users_failed, usersSkipped: row.users_skipped };
        return { id: row.id, startedAt: row.started_at, aliveAt: row.alive_at, endedAt: row.ended_at, outcome: row.outcome, reason: row.reason, incomplete: row.incomplete === 1, totals };
    },
    parts: async (runId) => {
        const rows = await db.selectFrom("run_users").selectAll().where("run_id", "=", runId).orderBy("user_id").execute();
        return rows.map((row) => ({ runId: row.run_id, userId: row.user_id, partId: row.part_id, startedAt: row.started_at, endedAt: row.ended_at, outcome: row.outcome, reason: row.reason, totals: row.ended_at === null ? null : tally(row) }));
    },
    fetches: async (userId) => {
        const rows = await db.selectFrom("source_fetches").selectAll().where("user_id", "=", userId).orderBy("id").execute();
        return rows.map((row) => ({ userId: row.user_id, sourceId: row.source_id, partId: row.part_id, module: row.module, at: row.at, ms: row.ms, outcome: row.outcome as FetchRecord["outcome"], reason: row.reason, pages: row.pages, jobs: row.jobs, cost: row.cost }));
    },
    mails: async () => (await db.selectFrom("mail_sends").select(["at", "kind", "outcome", "reason"]).orderBy("id").execute()) as MailSend[],
});

async function emptyStores() {
    await emptyWithOwner(db);
    return withOwner({ ...storesOver(db), close: async () => {} });
}

monitoringStrictCases(emptyStores, hooks);
monitoringReadCases(emptyStores, hooks);
