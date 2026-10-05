import type { FileConfig } from "../config/schema.js";
import type { JobView, JobViews, Page } from "../db/jobViews.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import { boostedScore, maxBoost, titleBoost } from "../jobs/titleBoost.js";
import { jobRow, verdictRow, type RowContext } from "./rows.js";

interface TabInput {
  views: JobViews;
  config: FileConfig;
  page: Page;
  now: Date;
}

export interface TabData {
  rows: string[];
  total: number;
  summary: string;
  empty: string;
}

export interface Tab {
  path: string;
  label: string;
  headers: string[];
  load(input: TabInput): TabData;
}

const JOB_HEADERS = ["Score", "Title", "Company", "Location", "Remote", "Source", "Posted", "Scored"];
const VERDICT_HEADERS = ["Scored at", "Run", "Job", "Company", "Score", "Reasons", "Gaps"];

export const TABS: Tab[] = [
  { path: "/recommended", label: "Recommended", headers: JOB_HEADERS, load: loadRecommended },
  { path: "/jobs", label: "All jobs", headers: JOB_HEADERS, load: loadAllJobs },
  { path: "/reasoning", label: "Reasoning", headers: VERDICT_HEADERS, load: loadReasoning },
];

function loadRecommended({ views, config, page, now }: TabInput): TabData {
  const jobs = recommendedJobs(views, config);
  const rows = jobs.slice(page.offset, page.offset + page.limit).map((job) => jobRow(job, rowContext(config, now)));
  const summary = `${jobs.length} recommended · threshold ${config.match_threshold}`;
  return { rows, total: jobs.length, summary, empty: "No recommendations yet: run myjobbot run." };
}

function recommendedJobs(views: JobViews, config: FileConfig): JobView[] {
  const threshold = config.match_threshold;
  const scored = views.scoredFrom({ sources: sourceNames(config), minScore: threshold - maxBoost(config.title_boosts) });
  const shown = scored.filter((job) => !isExcludedCompany(job.company, config.exclude_companies));
  return shown.filter((job) => boostedScore(job.score ?? 0, titleBoost(job.title, config.title_boosts)) >= threshold);
}

function loadAllJobs({ views, config, page, now }: TabInput): TabData {
  const total = views.countAllJobs();
  const rows = views.allJobs(page).map((job) => jobRow(job, rowContext(config, now)));
  return { rows, total, summary: `${total} jobs`, empty: "No jobs retrieved yet: run myjobbot run." };
}

function loadReasoning({ views, page }: TabInput): TabData {
  const total = views.countVerdicts();
  const rows = views.verdictHistory(page).map(verdictRow);
  return { rows, total, summary: `${total} scoring decisions`, empty: "No jobs scored yet: run myjobbot run." };
}

function sourceNames(config: FileConfig): string[] {
  return [...config.companies, ...config.searches].map((source) => source.name);
}

function rowContext(config: FileConfig, now: Date): RowContext {
  return { now, ghostDays: config.ghost_threshold_days, titleFilter: config.title_filter, boosts: config.title_boosts, excludedCompanies: config.exclude_companies };
}
