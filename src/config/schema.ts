import { z } from "zod";
import { ATS_NAMES } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";

const DEFAULT_INCLUDE = [
  "engineer", "developer", "software", "sre", "devops", "platform",
  "backend", "frontend", "full stack", "fullstack", "programmer",
];
const DEFAULT_EXCLUDE = ["intern", "internship", "manager", "director", "sales", "recruiter", "recruiting", "recruitment"];

const company = z.object({
  name: z.string().min(1),
  ats: z.enum(ATS_NAMES),
  slug: z.string().min(1),
});

const search = z.object({
  name: z.string().min(1),
  query: z.string().min(1),
  remote_only: z.boolean().default(false),
  country: z.string().min(2).default("us"),
});

const jsearch = z.object({
  monthly_request_cap: z.number().int().min(1).default(190),
  refresh_hours: z.number().min(1).default(24),
  date_posted: z.enum(["today", "3days", "7days", "30days"]).default("3days"),
});

const HOURS_PER_MONTH = 30 * 24;
export const REFRESH_GRACE_HOURS = 0.25;

const filterTerm = z
  .string()
  .refine((term) => normalizeTitle(term) !== "", { message: "filter terms need at least one letter or digit" });

const titleFilter = z
  .object({
    include: z.array(filterTerm).default(DEFAULT_INCLUDE),
    exclude: z.array(filterTerm).default(DEFAULT_EXCLUDE),
    extra_exclude: z.array(filterTerm).default([]),
  })
  .transform(({ include, exclude, extra_exclude }) => ({ include, exclude: [...exclude, ...extra_exclude] }));

const agent = z.object({
  max_steps: z.number().int().min(1).default(600),
  max_wall_clock_min: z.number().min(1).default(120),
  max_consecutive_tool_errors: z.number().int().min(1).default(3),
  context_chars: z.number().int().min(10_000).default(160_000),
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
    companies: z.array(company).default([]),
    searches: z.array(search).default([]),
    jsearch: jsearch.prefault({}),
    preferences: z.string().default(""),
    match_threshold: z.number().int().min(0).max(100).default(70),
    ghost_threshold_days: z.number().int().min(1).default(60),
    job_retention_days: z.number().int().min(1).default(90),
    title_filter: titleFilter.prefault({}),
    exclude_companies: z.array(filterTerm).default([]),
    title_boosts: z.record(filterTerm, z.number().int().min(1).max(100)).default({}),
    agent: agent.prefault({}),
    http: http.prefault({}),
  })
  .refine(hasAtLeastOneSource, { message: "configure at least one company or search" })
  .refine(hasUniqueSourceNames, { message: "company and search names must be unique" })
  .refine(fitsJsearchBudget, {
    message: "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours",
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
  MYJOBBOT_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  MYJOBBOT_HOST: z.string().min(1).default("127.0.0.1"),
});

interface SourceLists {
  companies: Array<{ name: string }>;
  searches: Array<{ name: string }>;
}

/** Validates that the config defines at least one company or saved-search source to work from. */
function hasAtLeastOneSource(config: SourceLists): boolean {
  return config.companies.length + config.searches.length > 0;
}

/** Validates that company and search names are unique across both lists, since names identify sources. */
function hasUniqueSourceNames(config: SourceLists): boolean {
  return hasUniqueNames([...config.companies, ...config.searches]);
}

/** Validates that refreshing all configured searches won't exceed the JSearch monthly request cap. */
function fitsJsearchBudget(config: SourceLists & { jsearch: { monthly_request_cap: number; refresh_hours: number } }): boolean {
  const refreshesPerMonth = Math.ceil(HOURS_PER_MONTH / (config.jsearch.refresh_hours - REFRESH_GRACE_HOURS));
  return config.searches.length * refreshesPerMonth <= config.jsearch.monthly_request_cap;
}

/** Reports whether a list of named entries has no duplicate names, ignoring case. */
function hasUniqueNames(list: Array<{ name: string }>): boolean {
  const names = list.map((entry) => entry.name.toLowerCase());
  return new Set(names).size === names.length;
}

/** Validates job retention outlasts the ghost-job threshold so repost history survives for ghost detection. */
function hasLongerRetentionThanGhostThreshold(config: { ghost_threshold_days: number; job_retention_days: number }): boolean {
  return config.job_retention_days > config.ghost_threshold_days;
}

export type FileConfig = z.infer<typeof fileConfigSchema>;
export type Env = z.infer<typeof envSchema>;
