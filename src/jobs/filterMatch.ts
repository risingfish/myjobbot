import type { FileConfig } from "../config/schema.js";
import { passesBodyFilter } from "./bodyFilter.js";
import { isExcludedCompany } from "./companyFilter.js";
import type { DescriptionFormat } from "./job.js";
import { passesTitleFilter } from "./titleFilter.js";

type FilterName = "company" | "title" | "body";

export interface FilterSet {
    excludedCompanies: FileConfig["exclude_companies"];
    titleFilter: FileConfig["title_filter"];
    bodyFilter: FileConfig["body_filter"];
}

interface FilterableJob {
    title: string;
    company: string;
    description: string | null;
    description_format: DescriptionFormat | null;
}

export const FILTER_NOTES: Record<FilterName, string> = {
    company: "hidden: excluded company",
    title: "hidden by title filter",
    body: "hidden by body filter",
};

/** Picks the company, title and body filters out of the settings. */
export function filterSet(config: FileConfig): FilterSet {
    return { excludedCompanies: config.exclude_companies, titleFilter: config.title_filter, bodyFilter: config.body_filter };
}

/** Names the first filter that hides a job, checking the company, then the title, then the description, or null when none does. */
export function filterMatch(job: FilterableJob, filters: FilterSet): FilterName | null {
    if (isExcludedCompany(job.company, filters.excludedCompanies)) return "company";
    if (!passesTitleFilter(job.title, filters.titleFilter)) return "title";
    return passesBodyFilter(job.description, job.description_format, filters.bodyFilter) ? null : "body";
}
