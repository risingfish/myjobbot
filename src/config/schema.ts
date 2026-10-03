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

const companies = z
  .array(company)
  .min(1)
  .refine(hasUniqueNames, { message: "company names must be unique" });

const filterTerm = z
  .string()
  .refine((term) => normalizeTitle(term) !== "", { message: "filter terms need at least one letter or digit" });

const titleFilter = z.object({
  include: z.array(filterTerm).default(DEFAULT_INCLUDE),
  exclude: z.array(filterTerm).default(DEFAULT_EXCLUDE),
});

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

export const fileConfigSchema = z.object({
  companies,
  preferences: z.string().default(""),
  match_threshold: z.number().int().min(0).max(100).default(70),
  ghost_threshold_days: z.number().int().min(1).default(60),
  job_retention_days: z.number().int().min(1).default(90),
  title_filter: titleFilter.prefault({}),
  agent: agent.prefault({}),
  http: http.prefault({}),
});

export const envSchema = z.object({
  LLM_BASE_URL: z.url(),
  LLM_MODEL: z.string().min(1),
  LLM_API_KEY: z.string().min(1),
  MYJOBBOT_DATA_DIR: z.string().min(1).default("data"),
});

function hasUniqueNames(list: Array<{ name: string }>): boolean {
  const names = list.map((entry) => entry.name.toLowerCase());
  return new Set(names).size === names.length;
}

export type FileConfig = z.infer<typeof fileConfigSchema>;
export type Env = z.infer<typeof envSchema>;
