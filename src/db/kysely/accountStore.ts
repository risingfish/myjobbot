import type { Kysely, Selectable } from "kysely";
import type { Account, AccountStore, OwnerLogin, SecurityEvent } from "../accountStore.js";
import type { Database } from "../schema.js";
import type { UsersTable } from "../schema/users.js";
import { OWNER_ID } from "../searchSettingsStore.js";
import { ensureOwner } from "./searchSettingsStore.js";

export class KyselyAccountStore implements AccountStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Gives the owner an email, the admin mark and a usable password, only while the owner has no email. */
    async initOwner(owner: OwnerLogin, now: string): Promise<boolean> {
        return this.db.transaction().execute(async (trx) => {
            await ensureOwner(trx, now);
            const result = await trx.updateTable("users").set({ email: owner.email, email_key: owner.emailKey, is_admin: 1 }).where("id", "=", OWNER_ID).where("email", "is", null).executeTakeFirst();
            if (result.numUpdatedRows === 0n) return false;
            const row = { enabled: 1, ready: 1, password_digest: owner.passwordDigest, updated_at: now };
            await trx
                .insertInto("sign_in_methods")
                .values({ user_id: OWNER_ID, kind: "password", ...row })
                .onDuplicateKeyUpdate(row)
                .execute();
            return true;
        });
    }

    /** Returns the account with a normalised email, or null. */
    async byEmailKey(emailKey: string): Promise<Account | null> {
        const row = await this.db.selectFrom("users").selectAll().where("email_key", "=", emailKey).executeTakeFirst();
        return row === undefined ? null : fromRow(row);
    }

    /** Returns one account, or null. */
    async account(id: number): Promise<Account | null> {
        const row = await this.db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
        return row === undefined ? null : fromRow(row);
    }

    /** Says whether an account holds the admin mark. */
    async isAdmin(id: number): Promise<boolean> {
        return (await this.account(id))?.isAdmin ?? false;
    }

    /** Stores one security event. */
    async recordEvent(event: SecurityEvent): Promise<void> {
        await this.db.insertInto("security_events").values({ user_id: event.userId, at: event.at, address: event.address, event: event.event, method: event.method }).execute();
    }
}

/** Turns a stored user row into an account. */
function fromRow(row: Selectable<UsersTable>): Account {
    return { id: row.id, name: row.name, email: row.email, isAdmin: row.is_admin === 1 };
}
