import type { Kysely, Transaction } from "kysely";
import type { AccountRemoval, RemovalOutcome } from "../accountRemoval.js";
import type { Database } from "../schema.js";

type UserTable = { [Table in keyof Database]: "user_id" extends keyof Database[Table] ? Table : never }[keyof Database];

/** Gives back the per-user tables in the order they are emptied; a table with a user_id column missing from the list fails the type check. */
function everyUserTable<const Listed extends readonly UserTable[]>(tables: Listed & ([Exclude<UserTable, Listed[number]>] extends [never] ? unknown : { missing: Exclude<UserTable, Listed[number]> })): Listed {
    return tables;
}

const USER_TABLES = everyUserTable(["run_users", "source_fetches", "user_jobs", "verdicts", "rescore_runs", "gmail_alert_state", "gmail_connection", "resume_profiles", "resumes", "user_sources", "user_settings", "sign_in_methods", "hardware_keys", "recovery_codes", "sessions", "email_tokens", "auth_challenges", "security_events"]);

export class KyselyAccountRemoval implements AccountRemoval {
    constructor(private readonly db: Kysely<Database>) {}

    /** Lists the accounts whose requested deletion is due, oldest due first. */
    async due(now: string): Promise<number[]> {
        const rows = await this.db.selectFrom("users").select("id").where("delete_after", "<=", now).orderBy("delete_after").orderBy("id").execute();
        return rows.map((row) => row.id);
    }

    /** Deletes an account whose deletion is due and every row of its own, in one transaction; never the only admin, and never one whose deletion was cancelled meanwhile. */
    async remove(userId: number, now: string): Promise<RemovalOutcome> {
        return this.db.transaction().execute(async (trx) => {
            const outcome = await this.check(trx, userId, now);
            if (outcome !== "deleted") return outcome;
            for (const table of USER_TABLES) await trx.deleteFrom(table).where("user_id", "=", userId).execute();
            await trx.deleteFrom("users").where("id", "=", userId).execute();
            return outcome;
        });
    }

    /** Locks the account and the admins in one ordered read, as the admin mark's own changes do, and says whether the account may go. */
    private async check(trx: Transaction<Database>, userId: number, now: string): Promise<RemovalOutcome> {
        const rows = await trx
            .selectFrom("users")
            .select(["id", "is_admin", "delete_after"])
            .where((eb) => eb.or([eb("id", "=", userId), eb("is_admin", "=", 1)]))
            .orderBy("id")
            .forUpdate()
            .execute();
        const user = rows.find((row) => row.id === userId);
        if (user === undefined) return "gone";
        if (user.delete_after === null || user.delete_after > now) return "not_due";
        return user.is_admin === 1 && rows.filter((row) => row.is_admin === 1).length === 1 ? "last_admin" : "deleted";
    }
}
