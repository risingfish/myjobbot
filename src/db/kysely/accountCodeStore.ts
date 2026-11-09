import type { Kysely } from "kysely";
import { CODE_DAYS, daysAfter, type AccountCodeStore } from "../accountCodeStore.js";
import type { Database } from "../schema.js";

export class KyselyAccountCodeStore implements AccountCodeStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Stores an account creation code by its digest, working for 7 days. */
    async makeCode(digest: string, createdBy: number, now: string): Promise<void> {
        await this.db
            .insertInto("account_codes")
            .values({ digest, created_by: createdBy, created_at: now, expires_at: daysAfter(now, CODE_DAYS) })
            .execute();
    }
}
