import type { CompanyStore } from "../../src/db/companyStore.js";
import type { CompanyPage } from "../../src/db/store.js";
import { recordMemoryCompanies } from "./memoryCompanies.js";
import type { Tables } from "./memoryJobViews.js";

export class MemoryCompanyStore implements CompanyStore {
    constructor(private readonly tables: Tables) {}

    async setBoardPage(page: CompanyPage, at: string): Promise<void> {
        if (!this.tables.companies.some((row) => row.company_key === page.key)) recordMemoryCompanies(this.tables, [{ key: page.key, name: page.name, firstSeen: at, lastSeen: at }]);
        const company = this.tables.companies.find((row) => row.company_key === page.key);
        if (company) Object.assign(company, { careers_url: page.url, careers_source: "board", careers_reason: null, careers_rejected: null });
    }
}
