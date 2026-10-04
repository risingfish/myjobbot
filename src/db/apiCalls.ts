import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const RECORD = "INSERT INTO api_calls (api, source, called_at) VALUES (?, ?, ?)";
const LAST_CALL = "SELECT MAX(called_at) AS last FROM api_calls WHERE api = ? AND source = ?";
const COUNT_SINCE = "SELECT COUNT(*) AS count FROM api_calls WHERE api = ? AND called_at >= ?";
const PRUNE = "DELETE FROM api_calls WHERE called_at < ?";

export class ApiCallLog {
  constructor(private readonly db: DatabaseSync) {}

  record(api: string, source: string, calledAt: string): void {
    this.db.prepare(RECORD).run(api, source, calledAt);
  }

  lastCallAt(api: string, source: string): string | null {
    return z.object({ last: z.string().nullable() }).parse(this.db.prepare(LAST_CALL).get(api, source)).last;
  }

  countSince(api: string, since: string): number {
    return z.object({ count: z.number() }).parse(this.db.prepare(COUNT_SINCE).get(api, since)).count;
  }

  pruneBefore(cutoff: string): void {
    this.db.prepare(PRUNE).run(cutoff);
  }
}
