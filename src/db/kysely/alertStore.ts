import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "../schema.js";
import type { AlertRead, AlertStateRow, AlertStore } from "../store.js";

const ROW = 1;
const COLUMNS = ["uid_validity", "last_uid", "last_run_at", "emails_read", "jobs_found", "not_understood"] as const;
const count = z.coerce.number();
const uid = z.coerce.number().nullable();
const rowSchema = z.object({ uid_validity: uid, last_uid: uid, last_run_at: z.string().nullable(), emails_read: count, jobs_found: count, not_understood: count });

export class KyselyAlertStore implements AlertStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns where alert reading stopped and what the last run found, or null before any read. */
    async state(): Promise<AlertStateRow | null> {
        const row = await this.db.selectFrom("gmail_alert_state").select(COLUMNS).where("id", "=", ROW).executeTakeFirst();
        return row === undefined ? null : rowSchema.parse(row);
    }

    /** Records a run's alert read: the new read marker and the run's counts. */
    async recordRead(read: AlertRead, at: string): Promise<void> {
        const values = { uid_validity: read.uidValidity, last_uid: read.lastUid, last_run_at: at, emails_read: read.emails, jobs_found: read.jobs, not_understood: read.notUnderstood };
        await this.db
            .insertInto("gmail_alert_state")
            .values({ id: ROW, ...values })
            .onDuplicateKeyUpdate(values)
            .execute();
    }

    /** Forgets where alert reading stopped, so the next connection starts from the last 7 days. */
    async clear(): Promise<void> {
        await this.db.deleteFrom("gmail_alert_state").where("id", "=", ROW).execute();
    }
}
