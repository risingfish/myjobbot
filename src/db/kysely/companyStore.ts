import type { Kysely } from "kysely";
import type { CompanyStore } from "../companyStore.js";
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
}
