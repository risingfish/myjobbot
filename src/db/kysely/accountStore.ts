import type { Kysely, Selectable } from "kysely";
import type { Account, AccountStore, CreateResult, NewAccount, OwnerLogin } from "../accountStore.js";
import { createAccountIn, createAccountSafely } from "./accountCreation.js";
import type { Database } from "../schema.js";
import type { UsersTable } from "../schema/users.js";
import { OWNER_ID } from "../owner.js";
import { ensureOwnerFor } from "./owner.js";

export class KyselyAccountStore implements AccountStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Gives the owner an email, the admin mark and a usable password, only while the owner has no email. */
    async initOwner(owner: OwnerLogin, now: string): Promise<boolean> {
        return this.db.transaction().execute(async (trx) => {
            await ensureOwnerFor(trx, OWNER_ID, now);
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

    /** Makes an account with an unspent creation code, spending it in the same transaction. */
    async createAccount(account: NewAccount, codeDigest: string, now: string): Promise<CreateResult> {
        return createAccountSafely(() => this.db.transaction().execute((trx) => createAccountIn(trx, { account, codeDigest, now })));
    }

    /** Lists every account with an email, oldest first. */
    async accounts(): Promise<Account[]> {
        const rows = await this.db.selectFrom("users").selectAll().where("email", "is not", null).orderBy("id").execute();
        return rows.map(fromRow);
    }

    /** Lists every user's id in order, those without an email included, so a run can go through them all. */
    async userIds(): Promise<number[]> {
        const rows = await this.db.selectFrom("users").select("id").orderBy("id").execute();
        return rows.map((row) => row.id);
    }

    /** Sets or clears an account's admin mark, refusing to clear the last one; the admin rows are locked so two removals can't leave none. */
    async setAdmin(userId: number, admin: boolean): Promise<"ok" | "last_admin"> {
        return this.db.transaction().execute(async (trx) => {
            const admins = await trx.selectFrom("users").select("id").where("is_admin", "=", 1).forUpdate().execute();
            if (!admin && admins.length === 1 && admins[0]?.id === userId) return "last_admin";
            await trx
                .updateTable("users")
                .set({ is_admin: admin ? 1 : 0 })
                .where("id", "=", userId)
                .execute();
            return "ok";
        });
    }

    /** Changes an account's name. */
    async saveName(userId: number, name: string): Promise<void> {
        await this.db.updateTable("users").set({ name }).where("id", "=", userId).execute();
    }

    /** Changes an account's email and its key, refusing a key another account holds. */
    async changeEmail(userId: number, email: string, emailKey: string): Promise<"ok" | "taken"> {
        const holder = await this.db.selectFrom("users").select("id").where("email_key", "=", emailKey).where("id", "<>", userId).executeTakeFirst();
        if (holder !== undefined) return "taken";
        try {
            await this.db.updateTable("users").set({ email, email_key: emailKey }).where("id", "=", userId).execute();
            return "ok";
        } catch (error) {
            if ((error as { code?: unknown } | null)?.code === "ER_DUP_ENTRY") return "taken";
            throw error;
        }
    }
}

/** Turns a stored user row into an account. */
function fromRow(row: Selectable<UsersTable>): Account {
    return { id: row.id, name: row.name, email: row.email, isAdmin: row.is_admin === 1 };
}
