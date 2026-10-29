import type { AddressPick } from "../companies/pickAddresses.js";
import type { CompanyPage } from "./store.js";

export interface CompanyRow {
    id: number;
    company_key: string;
    name: string;
    website_url: string | null;
    careers_url: string | null;
    careers_rejected: string | null;
}

export interface SearchRecord {
    website: AddressPick | null;
    careers: AddressPick | null;
}

export interface CompanyStore {
    setBoardPage(page: CompanyPage, at: string): Promise<number>;
    dueForSearch(limit: number, cutoff: string): Promise<CompanyRow[]>;
    recordSearch(id: number, record: SearchRecord, at: string): Promise<void>;
    markUnavailable(ids: number[], at: string): Promise<void>;
}
