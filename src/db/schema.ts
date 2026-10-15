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
    client_id: Text;
    client_secret: Text;
    credentials_saved_at: Text;
    refresh_token: Text;
    email: Text;
    connected_at: Text;
    status: Generated<string>;
    reason: Text;
}

interface GmailConnectRequestsTable {
    state: string;
    code_verifier: string;
    created_at: string;
}

export interface Database {
    jobs: JobsTable;
    verdicts: VerdictsTable;
    api_calls: ApiCallsTable;
    gmail_connection: GmailConnectionTable;
    gmail_connect_requests: GmailConnectRequestsTable;
}
