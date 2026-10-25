import { searchColumns } from "../../src/companies/searchColumns.js";
import type { CompanyRow, CompanyStore, SearchRecord } from "../../src/db/companyStore.js";
import type { CompanyPage } from "../../src/db/store.js";
import { recordMemoryCompanies } from "./memoryCompanies.js";
import { asc, type Row, type Tables } from "./memoryJobViews.js";

export class MemoryCompanyStore implements CompanyStore {
    constructor(private readonly tables: Tables) {}

    async setBoardPage(page: CompanyPage, at: string): Promise<void> {
        if (!this.tables.companies.some((row) => row.company_key === page.key)) recordMemoryCompanies(this.tables, [{ key: page.key, name: page.name, firstSeen: at, lastSeen: at }]);
        const company = this.tables.companies.find((row) => row.company_key === page.key);
        if (company) Object.assign(company, { careers_url: page.url, careers_source: "board", careers_reason: null, careers_rejected: null });
    }

    async dueForSearch(limit: number, cutoff: string): Promise<CompanyRow[]> {
        const due = this.tables.companies.filter((row) => (row.website_url === null || row.careers_url === null) && (row.searched_at === null || String(row.searched_at) < cutoff));
        return due.sort((a, b) => asc(b.last_found_date, a.last_found_date) || Number(a.id) - Number(b.id)).slice(0, limit).map(companyRow);
    }

    async recordSearch(id: number, record: SearchRecord, at: string): Promise<void> {
        const company = this.tables.companies.find((row) => row.id === id);
        if (company) Object.assign(company, searchColumns(record, at));
    }

    async markUnavailable(ids: number[], at: string): Promise<void> {
        for (const company of this.tables.companies.filter((row) => ids.includes(Number(row.id)))) {
            Object.assign(company, { searched_at: at, website_reason: company.website_url === null ? "search_unavailable" : company.website_reason, careers_reason: company.careers_url === null ? "search_unavailable" : company.careers_reason });
        }
    }
}

function text(value: Row[string] | undefined): string | null {
    return value === undefined || value === null ? null : String(value);
}

function companyRow(row: Row): CompanyRow {
    return { id: Number(row.id), company_key: String(row.company_key), name: String(row.name), website_url: text(row.website_url), careers_url: text(row.careers_url), careers_rejected: text(row.careers_rejected) };
}
