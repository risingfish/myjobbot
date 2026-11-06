import type { Transaction } from "kysely";
import type { CreateResult, NewAccount } from "../accountStore.js";
import type { Database } from "../schema.js";

type Trx = Transaction<Database>;

/** Spends an unspent, unexpired account creation code in the statement that checks it, saying whether it was. */
async function spendCode(trx: Trx, digest: string, now: string): Promise<boolean> {
    const result = await trx.updateTable("account_codes").set({ used_at: now }).where("digest", "=", digest).where("used_at", "is", null).where("expires_at", ">", now).executeTakeFirst();
    return result.numUpdatedRows === 1n;
}

/** Inserts the new account's user row and its usable password, and records it on the code. */
async function insertAccount(trx: Trx, input: { account: NewAccount; codeDigest: string; now: string }): Promise<number> {
    const { account, codeDigest, now } = input;
    const user = await trx.insertInto("users").values({ name: account.name, created_at: now, email: account.email, email_key: account.emailKey, is_admin: 0 }).executeTakeFirstOrThrow();
    const userId = Number(user.insertId);
    await trx.insertInto("sign_in_methods").values({ user_id: userId, kind: "password", enabled: 1, ready: 1, password_digest: account.passwordDigest, updated_at: now }).execute();
    await trx.updateTable("account_codes").set({ used_by: userId }).where("digest", "=", codeDigest).execute();
    return userId;
}

/** Says whether an error is MariaDB refusing a duplicate key. */
function duplicate(error: unknown): boolean {
    return (error as { code?: unknown } | null)?.code === "ER_DUP_ENTRY";
}

/** Makes an account in one transaction: refused unless the code is spent here, and taken, leaving the code unspent, when the email has an account. */
export async function createAccountIn(trx: Trx, input: { account: NewAccount; codeDigest: string; now: string }): Promise<CreateResult> {
    const taken = await trx.selectFrom("users").select("id").where("email_key", "=", input.account.emailKey).executeTakeFirst();
    if (taken !== undefined) return { kind: "taken" };
    if (!(await spendCode(trx, input.codeDigest, input.now))) return { kind: "refused" };
    return { kind: "created", userId: await insertAccount(trx, input) };
}

/** Runs the account creation, turning a duplicate email found only at insert, as when two run at once, into taken. */
export async function createAccountSafely(run: () => Promise<CreateResult>): Promise<CreateResult> {
    try {
        return await run();
    } catch (error) {
        if (duplicate(error)) return { kind: "taken" };
        throw error;
    }
}
