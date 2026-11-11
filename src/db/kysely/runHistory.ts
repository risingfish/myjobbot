import type { Kysely } from "kysely";
import type { TallyTotals } from "../../monitoring/tallyEvents.js";
import type { PartEnd, PartStart, RunEnding, RunHistory } from "../runHistory.js";
import type { Database } from "../schema.js";

/** Gives a tally's totals as the count columns runs and parts share. */
function tallyColumns(totals: TallyTotals) {
    return { fetches: totals.fetches, fetch_failures: totals.fetchFailures, jobs_found: totals.jobsFound, jobs_scored: totals.jobsScored, searches: totals.searches, search_failures: totals.searchFailures, model_calls: totals.modelCalls, prompt_tokens: totals.promptTokens, completion_tokens: totals.completionTokens };
}

export class KyselyRunHistory implements RunHistory {
    constructor(private readonly db: Kysely<Database>) {}

    /** Records that a run started, alive as of its start. */
    async begin(runId: string, at: string): Promise<void> {
        await this.db.insertInto("agent_runs").values({ id: runId, started_at: at, alive_at: at }).execute();
    }

    /** Records that a run is still alive, so one that stops showing it can be told apart from one still working. */
    async alive(runId: string, at: string): Promise<void> {
        await this.db.updateTable("agent_runs").set({ alive_at: at }).where("id", "=", runId).execute();
    }

    /** Records that a user's part of a run started, before any of its work. */
    async partStarted(part: PartStart): Promise<void> {
        await this.db.insertInto("run_users").values({ run_id: part.runId, user_id: part.userId, part_id: part.partId, started_at: part.at, outcome: "running" }).execute();
    }

    /** Records how a user's part of a run ended and what it did, writing the part when it was never started (a skip). */
    async partEnded(part: PartEnd): Promise<void> {
        const ending = { ended_at: part.endedAt, outcome: part.outcome, reason: part.reason, ...tallyColumns(part.totals) };
        await this.db
            .insertInto("run_users")
            .values({ run_id: part.runId, user_id: part.userId, part_id: part.partId, started_at: part.at, ...ending })
            .onDuplicateKeyUpdate(ending)
            .execute();
    }

    /** Marks that some of a run's record failed to be written while the run went on. */
    async markIncomplete(runId: string): Promise<void> {
        await this.db.updateTable("agent_runs").set({ incomplete: 1 }).where("id", "=", runId).execute();
    }

    /** Records how a run ended and its totals. */
    async end(runId: string, ending: RunEnding): Promise<void> {
        const { totals } = ending;
        const counts = { users: totals.users, users_failed: totals.usersFailed, users_skipped: totals.usersSkipped, ...tallyColumns(totals) };
        await this.db.updateTable("agent_runs").set({ ended_at: ending.at, alive_at: ending.at, outcome: ending.outcome, reason: ending.reason, ...counts }).where("id", "=", runId).execute();
    }

    /** Removes runs started before a cutoff, their parts with them. */
    async pruneBefore(cutoff: string): Promise<void> {
        await this.db.deleteFrom("agent_runs").where("started_at", "<", cutoff).execute();
    }
}
