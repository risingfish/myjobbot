import type { Kysely } from "kysely";
import { boundToSession, linkExpiry, type EmailLinkStore, type NewEmailToken, type SpentToken, type TokenLookup, type TokenSpend } from "../emailLinkStore.js";
import type { Database } from "../schema.js";

export class KyselyEmailLinkStore implements EmailLinkStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Stores an emailed link by its digest, ending the account's unused links of the same purpose. */
    async make(userId: number, token: NewEmailToken, now: string): Promise<void> {
        await this.db.transaction().execute(async (trx) => {
            await trx.updateTable("email_tokens").set({ used_at: now }).where("user_id", "=", userId).where("purpose", "=", token.purpose).where("used_at", "is", null).execute();
            await trx
                .insertInto("email_tokens")
                .values({ digest: token.digest, user_id: userId, purpose: token.purpose, new_email: token.newEmail ?? null, session_digest: token.sessionDigest ?? null, return_path: token.returnPath ?? null, created_at: now, expires_at: linkExpiry(token.purpose, now) })
                .execute();
        });
    }

    /** Spends an unused, unexpired link of a purpose in the statement that checks it, a session-bound one only from its own sign-in, and returns what it carries. */
    async spend(spend: TokenSpend, now: string): Promise<SpentToken | null> {
        let query = this.db.updateTable("email_tokens").set({ used_at: now }).where("digest", "=", spend.digest).where("purpose", "=", spend.purpose).where("used_at", "is", null).where("expires_at", ">", now);
        if (boundToSession(spend.purpose)) query = query.where("session_digest", "=", spend.sessionDigest ?? "");
        if ((await query.executeTakeFirst()).numUpdatedRows !== 1n) return null;
        const row = await this.db.selectFrom("email_tokens").select(["user_id", "new_email", "return_path"]).where("digest", "=", spend.digest).executeTakeFirstOrThrow();
        return { userId: row.user_id, newEmail: row.new_email, returnPath: row.return_path };
    }

    /** Looks a link up without spending it: its purpose, the sign-in it is bound to, and whether it still works. */
    async lookup(digest: string, now: string): Promise<TokenLookup | null> {
        const row = await this.db.selectFrom("email_tokens").select(["purpose", "session_digest", "used_at", "expires_at"]).where("digest", "=", digest).executeTakeFirst();
        return row === undefined ? null : { purpose: row.purpose, sessionDigest: row.session_digest, live: row.used_at === null && row.expires_at > now };
    }
}
