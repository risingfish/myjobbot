import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import { CODE_DAYS, daysAfter, type TokenStore } from "../tokenStore.js";

export class KyselyTokenStore implements TokenStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Stores an account creation code by its digest, working for 7 days. */
    async makeCode(digest: string, createdBy: number, now: string): Promise<void> {
        await this.db.insertInto("account_codes").values({ digest, created_by: createdBy, created_at: now, expires_at: daysAfter(now, CODE_DAYS) }).execute();
    }
}
