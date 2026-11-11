import type { Kysely } from "kysely";
import type { MailLog, MailSend } from "../mailLog.js";
import type { Database } from "../schema.js";

export class KyselyMailLog implements MailLog {
    constructor(private readonly db: Kysely<Database>) {}

    /** Records one mail send by its kind, outcome and fixed reason, never its address or content. */
    async record(send: MailSend): Promise<void> {
        await this.db.insertInto("mail_sends").values(send).execute();
    }

    /** Removes sends older than a cutoff. */
    async pruneBefore(cutoff: string): Promise<void> {
        await this.db.deleteFrom("mail_sends").where("at", "<", cutoff).execute();
    }
}
