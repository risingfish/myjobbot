import type { Generated } from "kysely";
import type { Count, Text } from "./columns.js";

export interface JobsTable {
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
    applied: Generated<number>;
    applied_on: Text;
    company_id: Count;
    source_id: Count;
}

export interface VerdictsTable {
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

export interface CompaniesTable {
    id: Generated<number>;
    company_key: string;
    name: string;
    website_url: Text;
    careers_url: Text;
    careers_source: Text;
    created_date: string;
    last_found_date: string;
    searched_at: Text;
    website_reason: Text;
    website_rejected: Text;
    careers_reason: Text;
    careers_rejected: Text;
}
