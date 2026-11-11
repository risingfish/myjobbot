import type { Kysely, Selectable } from "kysely";
import { storedPartOutcome, storedRunOutcome } from "../../monitoring/runStatus.js";
import type { TallyTotals } from "../../monitoring/tallyEvents.js";
import type { FetchRow, LookupRow, MailRow, MonitoringReads, PartRow, RescoreRow, RunRow } from "../monitoringReads.js";
import { storedFilter, storedOutcome } from "./rescoreLogStore.js";
import type { Database } from "../schema.js";
import type { AgentRunsTable, RunUsersTable } from "../schema/monitoring.js";

/** Reads the tally's counts from a run's or a part's columns. */
function tallyOf(row: Selectable<AgentRunsTable> | Selectable<RunUsersTable>): TallyTotals {
    return { fetches: row.fetches, fetchFailures: row.fetch_failures, jobsFound: row.jobs_found, jobsScored: row.jobs_scored, searches: row.searches, searchFailures: row.search_failures, modelCalls: row.model_calls, promptTokens: row.prompt_tokens, completionTokens: row.completion_tokens };
}

/** Reads one stored run. */
function runOf(row: Selectable<AgentRunsTable>): RunRow {
    const totals = { ...tallyOf(row), users: row.users, usersFailed: row.users_failed, usersSkipped: row.users_skipped };
    return { id: row.id, startedAt: row.started_at, aliveAt: row.alive_at, endedAt: row.ended_at, outcome: storedRunOutcome(row.outcome), reason: row.reason, incomplete: row.incomplete === 1, totals };
}

export class KyselyMonitoringReads implements MonitoringReads {
    constructor(private readonly db: Kysely<Database>) {}

    /** Lists the runs started since a time, newest first. */
    async runs(since: string): Promise<RunRow[]> {
        const rows = await this.db.selectFrom("agent_runs").selectAll().where("started_at", ">=", since).orderBy("started_at", "desc").execute();
        return rows.map(runOf);
    }

    /** Gives one run with each user's part of it, by user id, and how many careers lookups each part finished. */
    async run(runId: string): Promise<{ run: RunRow; parts: PartRow[] } | null> {
        const row = await this.db.selectFrom("agent_runs").selectAll().where("id", "=", runId).executeTakeFirst();
        if (row === undefined) return null;
        const parts = await this.db.selectFrom("run_users").selectAll().where("run_id", "=", runId).orderBy("user_id").execute();
        const lookups = await this.lookupCounts(parts.flatMap((part) => (part.part_id === null ? [] : [part.part_id])));
        return { run: runOf(row), parts: parts.map((part) => ({ userId: part.user_id, partId: part.part_id, startedAt: part.started_at, endedAt: part.ended_at, outcome: storedPartOutcome(part.outcome), reason: part.reason, totals: tallyOf(part), lookups: lookups.get(part.part_id ?? "") ?? 0 })) };
    }

    /** Lists the fetches made since a time, newest first, by source id and module only. */
    async fetches(since: string): Promise<FetchRow[]> {
        const rows = await this.db.selectFrom("source_fetches").select(["source_id", "module", "at", "outcome", "reason", "pages", "jobs", "cost"]).where("at", ">=", since).orderBy("at", "desc").orderBy("id", "desc").execute();
        return rows.map((row) => ({ sourceId: row.source_id, module: row.module, at: row.at, outcome: row.outcome, reason: row.reason, pages: row.pages, jobs: row.jobs, cost: row.cost }));
    }

    /** Lists the careers lookups' finishes and page reads since a time, by step, outcome, fixed reason and how the page was read only. */
    async lookups(since: string): Promise<LookupRow[]> {
        const rows = await this.db.selectFrom("careers_audit").select(["step", "outcome", "reason", "page_source"]).where("at", ">=", since).where("step", "in", ["finish", "open_careers", "open_job"]).orderBy("id").execute();
        return rows.map((row) => ({ step: row.step, outcome: row.outcome, reason: row.reason, pageSource: row.page_source }));
    }

    /** Lists every user's re-scores started since a time, with how they ended and their model use, never which job. */
    async rescores(since: string): Promise<RescoreRow[]> {
        const rows = await this.db.selectFrom("rescore_runs").select(["started_at", "ended_at", "outcome", "filter", "score", "model_calls", "prompt_tokens", "completion_tokens"]).where("started_at", ">=", since).execute();
        return rows.map((row) => ({ startedAt: row.started_at, endedAt: row.ended_at, outcome: storedOutcome.parse(row.outcome), filter: storedFilter.parse(row.filter), score: row.score, modelCalls: row.model_calls, promptTokens: row.prompt_tokens, completionTokens: row.completion_tokens }));
    }

    /** Lists the mail sends since a time, by kind, outcome and fixed reason. */
    async mails(since: string): Promise<MailRow[]> {
        return this.db.selectFrom("mail_sends").select(["at", "kind", "outcome", "reason"]).where("at", ">=", since).orderBy("at").orderBy("id").execute();
    }

    /** Counts the careers lookups each run part finished, from the careers audit. */
    private async lookupCounts(partIds: string[]): Promise<Map<string, number>> {
        if (partIds.length === 0) return new Map();
        const rows = await this.db
            .selectFrom("careers_audit")
            .select((eb) => ["run_id", eb.fn.countAll<number>().as("count")])
            .where("run_id", "in", partIds)
            .where("step", "=", "finish")
            .groupBy("run_id")
            .execute();
        return new Map(rows.map((row) => [row.run_id, Number(row.count)]));
    }
}
