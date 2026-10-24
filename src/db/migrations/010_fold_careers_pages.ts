import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

type TablesAtThisStep = {
    careers_pages: { company_key: string; company: string; url: string; found_at: string };
    companies: { company_key: string; name: string; careers_url: string | null; careers_source: string | null; created_date: string; last_found_date: string };
};

/** Moves each careers page the careers lookup remembered onto its company's record, creating the records that don't exist yet, then drops the old table. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db
        .withTables<TablesAtThisStep>()
        .insertInto("companies")
        .columns(["company_key", "name", "careers_url", "careers_source", "created_date", "last_found_date"])
        .expression((eb) => eb.selectFrom("careers_pages").select(["company_key", "company", "url", eb.val("lookup").as("careers_source"), "found_at", "found_at as last_found_date"]))
        .onDuplicateKeyUpdate((eb) => ({
            // MariaDB applies these left to right, so the source must be decided while the record's own careers_url is still the old one.
            careers_source: eb.case().when("careers_url", "is", null).then(sql<string>`VALUES(careers_source)`).else(eb.ref("careers_source")).end(),
            careers_url: eb.fn.coalesce("careers_url", sql<string>`VALUES(careers_url)`),
        }))
        .execute();
    await db.schema.dropTable("careers_pages").execute();
}

export const foldCareersPages: Migration = { up };
