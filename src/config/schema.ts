import { z } from "zod";
import { DEFAULT_ALERT_SENDERS, isAlertSender } from "../gmail/alerts.js";
import { normalizeTitle } from "../jobs/normalize.js";
import { isDomainEntry, isValidDomainEntry } from "../jobs/publisherDomain.js";

const DEFAULT_INCLUDE = ["engineer", "developer", "software", "sre", "devops", "platform", "backend", "frontend", "full stack", "fullstack", "programmer"];
const DEFAULT_EXCLUDE = ["intern", "internship", "manager", "director", "sales", "recruiter", "recruiting", "recruitment"];

export const REFRESH_GRACE_HOURS = 0.25;

export const filterTerm = z.string().refine((term) => normalizeTitle(term) !== "", { message: "filter terms need at least one letter or digit" });

export const publisherTerm = filterTerm.refine((entry) => !isDomainEntry(entry) || isValidDomainEntry(entry), {
    error: (issue) => `'${String(issue.input)}' is not a valid domain entry; use a host like 'jobmesh.io' or '*.trabajo.org'`,
});

export const boostPoints = z.number().int().min(1).max(100);

const jsearch = z.object({
    monthly_request_cap: z.number().int().min(1).default(190),
    refresh_hours: z.number().min(1).default(24),
    date_posted: z.enum(["today", "3days", "7days", "30days"]).default("3days"),
    exclude_publishers: z.array(publisherTerm).default([]),
});

const gmail = z.object({
    alert_senders: z.array(z.string().refine(isAlertSender, { error: (issue) => `'${String(issue.input)}' is not a valid alert sender; use an email address or a domain` })).default(DEFAULT_ALERT_SENDERS),
});

export const titleFilterTerms = z.object({
    include: z.array(filterTerm).default(DEFAULT_INCLUDE),
    exclude: z.array(filterTerm).default(DEFAULT_EXCLUDE),
    extra_exclude: z.array(filterTerm).default([]),
});

export const bodyFilterTerms = z.object({
    include: z.array(filterTerm).default([]),
    exclude: z.array(filterTerm).default([]),
});

const titleFilter = titleFilterTerms.transform(({ include, exclude, extra_exclude }) => ({ include, exclude: [...exclude, ...extra_exclude] }));

const agent = z.object({
    max_steps: z.number().int().min(1).default(600),
    max_wall_clock_min: z.number().min(1).default(120),
    max_consecutive_tool_errors: z.number().int().min(1).default(3),
    context_chars: z.number().int().min(10_000).default(160_000),
});

const careersLookup = z.object({
    max_per_run: z.number().int().min(1).default(10),
    max_total_minutes: z.number().min(1).default(30),
    max_minutes: z.number().min(1).default(5),
    page_chars: z.number().int().min(2000).default(12_000),
    search_results: z.number().int().min(1).max(20).default(10),
    max_download_kb: z.number().int().min(64).default(2048),
    render_seconds: z.number().int().min(5).max(60).default(15),
    lan_probe_url: z.url().optional(),
    skip_hosts: z.array(z.string().min(1).toLowerCase()).default(["glassdoor.com", "ziprecruiter.com", "indeed.com", "linkedin.com", "builtin.com", "teamworkonline.com"]),
});

const companySearch = z.object({
    max_per_run: z.number().int().min(0).default(50),
});

const http = z.object({
    min_interval_ms: z.number().int().min(0).default(1000),
    max_requests_per_host_per_run: z.number().int().min(1).default(300),
    max_retries: z.number().int().min(0).default(2),
    max_retry_after_s: z.number().min(0).default(60),
    timeout_s: z.number().min(1).default(30),
});

export const fileConfigSchema = z
    .object({
        jsearch: jsearch.prefault({}),
        preferences: z.string().default(""),
        match_threshold: z.number().int().min(0).max(100).default(70),
        ghost_threshold_days: z.number().int().min(1).default(60),
        job_retention_days: z.number().int().min(1).default(90),
        title_filter: titleFilter.prefault({}),
        body_filter: bodyFilterTerms.prefault({}),
        exclude_companies: z.array(filterTerm).default([]),
        title_boosts: z.record(filterTerm, boostPoints).default({}),
        agent: agent.prefault({}),
        http: http.prefault({}),
        gmail: gmail.prefault({}),
        careers_lookup: careersLookup.prefault({}),
        company_search: companySearch.prefault({}),
    })
    .refine(hasLongerRetentionThanGhostThreshold, {
        message: "job_retention_days must be greater than ghost_threshold_days so repost history survives long enough to flag ghosts",
    });

export const envSchema = z.object({
    LLM_BASE_URL: z.url(),
    LLM_MODEL: z.string().min(1),
    LLM_API_KEY: z.string().min(1),
    MYJOBBOT_DATA_DIR: z.string().min(1).default("data"),
    MYJOBBOT_LOG_DIR: z.string().min(1).default("log"),
    JSEARCH_API_KEY: z.string().min(1).optional(),
    MYJOBBOT_SEARXNG_URL: z.url().optional(),
    MYJOBBOT_BROWSER_URL: z.url({ protocol: /^wss?$/ }).optional(),
});

/** Validates job retention outlasts the ghost-job threshold so repost history survives for ghost detection. */
function hasLongerRetentionThanGhostThreshold(config: { ghost_threshold_days: number; job_retention_days: number }): boolean {
    return config.job_retention_days > config.ghost_threshold_days;
}

export type FileConfig = z.infer<typeof fileConfigSchema>;
export type Env = z.infer<typeof envSchema>;
