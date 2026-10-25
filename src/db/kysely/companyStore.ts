import type { Kysely } from "kysely";
import { searchColumns } from "../../companies/searchColumns.js";
import type { CompanyRow, CompanyStore, SearchRecord } from "../companyStore.js";
import type { Database } from "../schema.js";
import type { CompanyPage } from "../store.js";
import { ensureCompany } from "./companyRows.js";

export class KyselyCompanyStore implements CompanyStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Makes a configured board's public address its company's careers page, creating the record when there is none; it replaces any page a lookup or search found. */
    async setBoardPage(page: CompanyPage, at: string): Promise<void> {
        await ensureCompany(this.db, page, at);
        await this.db.updateTable("companies").set({ careers_url: page.url, careers_source: "board", careers_reason: null, careers_rejected: null }).where("company_key", "=", page.key).execute();
    }

    /** Lists companies still missing an address and not searched since the cutoff, the most recently found first, up to the limit. */
    async dueForSearch(limit: number, cutoff: string): Promise<CompanyRow[]> {
        return this.db
            .selectFrom("companies")
            .select(["id", "company_key", "name", "website_url", "careers_url", "careers_rejected"])
            .where((eb) => eb.and([eb.or([eb("website_url", "is", null), eb("careers_url", "is", null)]), eb.or([eb("searched_at", "is", null), eb("searched_at", "<", cutoff)])]))
            .orderBy("last_found_date", "desc")
            .orderBy("id")
            .limit(limit)
            .execute();
    }

    /** Stores what a company search found, why it found nothing for an address, and when it ran. */
    async recordSearch(id: number, record: SearchRecord, at: string): Promise<void> {
        await this.db.updateTable("companies").set(searchColumns(record, at)).where("id", "=", id).execute();
    }

    /** Marks companies whose search couldn't run, so each missing address says why and is tried again a day later. */
    async markUnavailable(ids: number[], at: string): Promise<void> {
        if (ids.length === 0) return;
        await this.db
            .updateTable("companies")
            .set((eb) => ({
                searched_at: at,
                website_reason: eb.case().when("website_url", "is", null).then(eb.val("search_unavailable")).else(eb.ref("website_reason")).end(),
                careers_reason: eb.case().when("careers_url", "is", null).then(eb.val("search_unavailable")).else(eb.ref("careers_reason")).end(),
            }))
            .where("id", "in", ids)
            .execute();
    }
}
