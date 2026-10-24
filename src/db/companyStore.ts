import type { CompanyPage } from "./store.js";

export interface CompanyStore {
    setBoardPage(page: CompanyPage, at: string): Promise<void>;
}
