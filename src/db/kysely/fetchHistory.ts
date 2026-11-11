import type { Kysely } from "kysely";
import { latestPerSource, type FetchHistory, type FetchRecord, type RecentFetch } from "../fetchHistory.js";
import type { Database } from "../schema.js";

export class KyselyFetchHistory implements FetchHistory {
    constructor(private readonly db: Kysely<Database>) {}

    /** Records one fetch, or planned skip, of a user's saved source. */
    async record(userId: number, fetch: FetchRecord): Promise<void> {
        await this.db
            .insertInto("source_fetches")
            .values({ user_id: userId, source_id: fetch.sourceId, part_id: fetch.partId, module: fetch.module, at: fetch.at, ms: fetch.ms, outcome: fetch.outcome, reason: fetch.reason, pages: fetch.pages, jobs: fetch.jobs, cost: fetch.cost })
            .execute();
    }

    /** Gives each of a user's sources' latest fetches, newest first. */
    async recent(userId: number, sourceIds: number[], perSource: number): Promise<Map<number, RecentFetch[]>> {
        if (sourceIds.length === 0) return new Map();
        const rows = await this.db.selectFrom("source_fetches").select(["source_id", "at", "outcome", "reason", "jobs"]).where("user_id", "=", userId).where("source_id", "in", sourceIds).orderBy("at", "desc").orderBy("id", "desc").execute();
        return latestPerSource(rows.map((row) => ({ sourceId: row.source_id, at: row.at, outcome: row.outcome as FetchRecord["outcome"], reason: row.reason, jobs: row.jobs })), perSource);
    }

    /** Removes fetches older than a cutoff. */
    async pruneBefore(cutoff: string): Promise<void> {
        await this.db.deleteFrom("source_fetches").where("at", "<", cutoff).execute();
    }
}
