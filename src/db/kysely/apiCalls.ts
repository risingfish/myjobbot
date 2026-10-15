import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { ApiCallLog } from "../store.js";

export class KyselyApiCallLog implements ApiCallLog {
    constructor(private readonly db: Kysely<Database>) {}

    /** Logs that an external API was called, so budget and refresh checks can see it later. */
    async record(api: string, source: string, calledAt: string): Promise<void> {
        await this.db.insertInto("api_calls").values({ api, source, called_at: calledAt }).execute();
    }

    /** Returns when a source was last fetched from an API, or null if it never was. */
    async lastCallAt(api: string, source: string): Promise<string | null> {
        const row = await this.db
            .selectFrom("api_calls")
            .select((eb) => eb.fn.max("called_at").as("last"))
            .where("api", "=", api)
            .where("source", "=", source)
            .executeTakeFirst();
        return row?.last ?? null;
    }

    /** Counts calls to an API since a timestamp, to enforce a monthly request budget. */
    async countSince(api: string, since: string): Promise<number> {
        const row = await this.db
            .selectFrom("api_calls")
            .select((eb) => eb.fn.countAll().as("count"))
            .where("api", "=", api)
            .where("called_at", ">=", since)
            .executeTakeFirstOrThrow();
        return Number(row.count);
    }

    /** Discards call records older than a cutoff, so the log doesn't grow unbounded. */
    async pruneBefore(cutoff: string): Promise<void> {
        await this.db.deleteFrom("api_calls").where("called_at", "<", cutoff).execute();
    }
}
