import type { Generated } from "kysely";
import type { Count, Text } from "./columns.js";

export interface CareersAuditTable {
    id: Generated<number>;
    run_id: string;
    at: string;
    ats: string;
    job_id: string;
    company: string;
    step: string;
    url: Text;
    chars: Count;
    cut: Generated<number>;
    more_pages: Generated<number>;
    outcome: string;
    reason: Text;
    warning: Generated<number>;
    detail: Text;
    page_source: Text;
    fallback: Text;
    board: Text;
    retry_once: Generated<number>;
}

export interface ApiCallsTable {
    id: Generated<number>;
    api: string;
    source: string;
    called_at: string;
}
