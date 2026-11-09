import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

type JobsAtThisStep = { jobs: { emailed_at: string | null } };

/** Drops the email-digest mark from postings, refusing while any posting holds one so no value is lost unseen. */
async function up(db: Kysely<unknown>): Promise<void> {
    const marked = await db
        .withTables<JobsAtThisStep>()
        .selectFrom("jobs")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("emailed_at", "is not", null)
        .executeTakeFirstOrThrow();
    const n = Number(marked.n);
    if (n > 0) throw new Error(`${n} postings have an email-digest mark, which nothing should have written; restore or clear it before upgrading`);
    await db.schema.alterTable("jobs").dropColumn("emailed_at").execute();
}

export const jobsWithoutDigestMark: Migration = { up };
