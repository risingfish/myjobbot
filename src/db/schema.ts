import type { Generated } from "kysely";

type Text = string | null;
type Count = number | null;

interface JobsTable {
    ats: string;
    job_id: string;
    company: string;
    source: string;
    title: string;
    normalized_title: string;
    location: Text;
    department: Text;
    team: Text;
    workplace_type: Text;
    is_remote: Count;
    compensation: Text;
    url: string;
    posted_at: Text;
    description: Text;
    description_format: Text;
    description_source: Text;
    description_url: Text;
    injection_seen_at: Text;
    publisher: Text;
    requirements: Text;
    skills: Text;
    preferred_skills: Text;
    first_seen: string;
    last_seen: string;
    scored_at: Text;
    score: Count;
    base_score: Count;
    bonus_score: Count;
    reasons: Text;
    gaps: Text;
    emailed_at: Text;
    hidden: Generated<number>;
}

interface VerdictsTable {
    id: Generated<number>;
    ats: string;
    job_id: string;
    run_id: Text;
    scored_at: string;
    score: number;
    base_score: Count;
    bonus_score: Count;
    reasons: string;
    gaps: string;
}

interface ApiCallsTable {
    id: Generated<number>;
    api: string;
    source: string;
    called_at: string;
}

interface GmailConnectionTable {
    id: number;
    email: Text;
    app_password: Text;
    connected_at: Text;
    status: Generated<string>;
    reason: Text;
}

interface GmailAlertStateTable {
    id: number;
    uid_validity: Count;
    last_uid: Count;
    last_run_at: Text;
    emails_read: Generated<number>;
    jobs_found: Generated<number>;
    not_understood: Generated<number>;
}

interface CareersPagesTable {
    company_key: string;
    company: string;
    url: string;
    found_at: string;
    last_used_at: string;
}

interface CareersAuditTable {
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

export interface Database {
    jobs: JobsTable;
    verdicts: VerdictsTable;
    api_calls: ApiCallsTable;
    gmail_connection: GmailConnectionTable;
    gmail_alert_state: GmailAlertStateTable;
    careers_pages: CareersPagesTable;
    careers_audit: CareersAuditTable;
}
