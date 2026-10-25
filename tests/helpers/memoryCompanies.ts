import type { CompanyKey } from "../../src/companies/keys.js";
import type { CompanyHooks, SearchOutcome, UnlinkedJob } from "./companyContract.js";
import type { Row, Tables } from "./memoryJobViews.js";

const NO_ADDRESSES = { website_url: null, careers_url: null, careers_source: null, searched_at: null, website_reason: null, website_rejected: null, careers_reason: null, careers_rejected: null };

function earlier(left: string, right: string): string {
    return left < right ? left : right;
}

function later(left: string, right: string): string {
    return left > right ? left : right;
}

export function recordMemoryCompanies(tables: Tables, keys: CompanyKey[]): Map<string, number> {
    const ids = new Map<string, number>();
    for (const entry of keys) {
        const existing = tables.companies.find((company) => company.company_key === entry.key);
        if (existing) Object.assign(existing, { created_date: earlier(String(existing.created_date), entry.firstSeen), last_found_date: later(String(existing.last_found_date), entry.lastSeen) });
        else tables.companies.push({ id: tables.companies.length + 1, company_key: entry.key, name: entry.name, created_date: entry.firstSeen, last_found_date: entry.lastSeen, ...NO_ADDRESSES });
        ids.set(entry.key, Number(tables.companies.find((company) => company.company_key === entry.key)?.id));
    }
    return ids;
}

export function touchMemoryCompany(tables: Tables, job: Row, seen: string): void {
    const company = tables.companies.find((row) => row.id === job.company_id);
    if (company) company.last_found_date = later(String(company.last_found_date), seen);
}

function text(value: Row[string] | undefined): string | null {
    return value === undefined || value === null ? null : String(value);
}

function searchOutcomeOf(row: Row | undefined): SearchOutcome | undefined {
    if (row === undefined) return undefined;
    const columns = ["website_url", "website_reason", "website_rejected", "careers_url", "careers_reason", "careers_rejected", "searched_at"] as const;
    return Object.fromEntries(columns.map((column) => [column, text(row[column])])) as unknown as SearchOutcome;
}

function unlinkedRow(job: UnlinkedJob): Row {
    return { ats: "greenhouse", job_id: job.jobId, company: job.company, source: job.company, title: "Engineer", normalized_title: "engineer", url: "u", first_seen: job.firstSeen, last_seen: job.lastSeen, company_id: null, applied: 0 };
}

export function memoryCompanyHooks(tables: () => Tables): CompanyHooks {
    return {
        listCompanies: async () => tables().companies.map((row) => ({ id: Number(row.id), company_key: String(row.company_key), name: String(row.name), created_date: String(row.created_date), last_found_date: String(row.last_found_date) })),
        jobLinks: async () => [...tables().jobs].sort((left, right) => String(left.job_id).localeCompare(String(right.job_id))).map((job) => ({ job_id: String(job.job_id), company_id: job.company_id === null ? null : Number(job.company_id) })),
        seedUnlinked: async (jobs) => void tables().jobs.push(...jobs.map(unlinkedRow)),
        searchOutcome: async (key) => searchOutcomeOf(tables().companies.find((row) => row.company_key === key)),
        seedBoardPage: async (key, url) => void tables().companies.push({ id: tables().companies.length + 1, company_key: key, name: key, created_date: "2026-10-01T00:00:00.000Z", last_found_date: "2026-10-01T00:00:00.000Z", ...NO_ADDRESSES, careers_url: url, careers_source: "board" }),
    };
}
