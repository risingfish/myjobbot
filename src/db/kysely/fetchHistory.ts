import type { Kysely } from "kysely";
import type { FetchHistory, FetchRecord } from "../fetchHistory.js";
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

    /** Removes fetches older than a cutoff. */
    async pruneBefore(cutoff: string): Promise<void> {
        await this.db.deleteFrom("source_fetches").where("at", "<", cutoff).execute();
    }
}
