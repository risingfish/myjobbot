import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { ApiCallLog } from "./store.js";

const RECORD = "INSERT INTO api_calls (api, source, called_at) VALUES (?, ?, ?)";
const LAST_CALL = "SELECT MAX(called_at) AS last FROM api_calls WHERE api = ? AND source = ?";
const COUNT_SINCE = "SELECT COUNT(*) AS count FROM api_calls WHERE api = ? AND called_at >= ?";
const PRUNE = "DELETE FROM api_calls WHERE called_at < ?";

export class SqliteApiCallLog implements ApiCallLog {
    constructor(private readonly db: DatabaseSync) {}

    /** Logs that an external API was called, so budget and refresh checks can see it later. */
    async record(api: string, source: string, calledAt: string): Promise<void> {
        this.db.prepare(RECORD).run(api, source, calledAt);
    }

    /** Returns when a source was last fetched from an API, or null if it never was. */
    async lastCallAt(api: string, source: string): Promise<string | null> {
        return z.object({ last: z.string().nullable() }).parse(this.db.prepare(LAST_CALL).get(api, source)).last;
    }

    /** Counts calls to an API since a timestamp, to enforce a monthly request budget. */
    async countSince(api: string, since: string): Promise<number> {
        return z.object({ count: z.number() }).parse(this.db.prepare(COUNT_SINCE).get(api, since)).count;
    }

    /** Discards call records older than a cutoff, so the log doesn't grow unbounded. */
    async pruneBefore(cutoff: string): Promise<void> {
        this.db.prepare(PRUNE).run(cutoff);
    }
}
