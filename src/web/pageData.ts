import type { Settings } from "../config/schema.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { JobView, JobViews, Page } from "../db/store.js";
import { appliedBoosts, boostedScore, boostLists, maxBoost } from "../jobs/boosts.js";
import { filterMatch, filterSet } from "../jobs/filterMatch.js";
import type { PageData, PageName } from "./api.js";
import { toJobRowView, toVerdictRowView, type RowContext } from "./rowViews.js";

export interface PageInput {
    views: JobViews;
    config: Settings;
    sourceNames: string[];
    page: Page;
    now: Date;
}

export type PageSettings = Pick<PageInput, "config" | "sourceNames">;

const LOADERS: Record<PageName, (input: PageInput) => Promise<PageData>> = {
    recommended: loadRecommended,
    applied: loadApplied,
    jobs: loadAllJobs,
    reasoning: loadReasoning,
};

/** Loads one page of display-ready rows, with its summary and empty-state text, for a web UI page. */
export async function loadPageData(name: PageName, input: PageInput): Promise<PageData> {
    return LOADERS[name](input);
}

/** Loads the page of jobs that meet the recommendation threshold, for the Recommended page. */
async function loadRecommended({ views, config, sourceNames, page, now }: PageInput): Promise<PageData> {
    const jobs = await recommendedJobs(views, { config, sourceNames });
    const rows = jobs.slice(page.offset, page.offset + page.limit).map((job) => toJobRowView(job, rowContext(config, now)));
    const text = { summary: `${jobs.length} recommended · threshold ${config.match_threshold}`, empty: "No recommendations yet: run myjobbot run." };
    return { kind: "jobs", rows, total: jobs.length, nextOffset: nextOffset(page, jobs.length), ...text };
}

/** Returns the jobs, from saved sources, not marked applied and not hidden by a filter as the filters stand now, whose boosted score meets the match threshold. */
async function recommendedJobs(views: JobViews, { config, sourceNames }: PageSettings): Promise<JobView[]> {
    const threshold = config.match_threshold;
    const lists = boostLists(config);
    const scored = await views.scoredFrom({ sources: sourceNames, minScore: threshold - maxBoost(lists) });
    const filters = filterSet(config);
    const shown = scored.filter((job) => !job.applied && filterMatch(job, filters) === null);
    return shown.filter((job) => boostedScore(job.score ?? 0, appliedBoosts(job, lists)) >= threshold);
}

/** Loads a page of all retrieved jobs, for the All jobs page. */
async function loadAllJobs(input: PageInput): Promise<PageData> {
    const total = await input.views.countAllJobs();
    return jobList(input, { total, jobs: await input.views.allJobs(input.page), summary: `${total} jobs`, empty: "No jobs retrieved yet: run myjobbot run." });
}

/** Loads a page of the jobs marked applied, most recently marked first, for the Applied page. */
async function loadApplied(input: PageInput): Promise<PageData> {
    const total = await input.views.countApplied();
    return jobList(input, { total, jobs: await input.views.appliedJobs(input.page), summary: `${total} applied`, empty: "No jobs marked applied yet: use a job's Applied button." });
}

/** Turns one page of a job list into display-ready rows with its total, summary and empty-state text. */
function jobList({ config, page, now }: PageInput, list: { total: number; jobs: JobView[]; summary: string; empty: string }): PageData {
    const rows = list.jobs.map((job) => toJobRowView(job, rowContext(config, now)));
    return { kind: "jobs", rows, total: list.total, nextOffset: nextOffset(page, list.total), summary: list.summary, empty: list.empty };
}

/** Loads a page of scoring verdict history, for the Reasoning page. */
async function loadReasoning({ views, page }: PageInput): Promise<PageData> {
    const total = await views.countVerdicts();
    const rows = (await views.verdictHistory(page)).map(toVerdictRowView);
    const text = { summary: `${total} scoring decisions`, empty: "No jobs scored yet: run myjobbot run." };
    return { kind: "verdicts", rows, total, nextOffset: nextOffset(page, total), ...text };
}

/** Returns the offset of the next page, or null when the current page reaches the end. */
function nextOffset(page: Page, total: number): number | null {
    const next = page.offset + page.limit;
    return next < total ? next : null;
}

/** Names every saved source, including those that are off, so their jobs stay on Recommended. */
export function sourceNames(saved: SavedSource[]): string[] {
    return saved.map((source) => source.name);
}

/** Builds the context row views need from the current config and time. */
export function rowContext(config: Settings, now: Date): RowContext {
    return { now, ghostDays: config.ghost_threshold_days, boosts: boostLists(config), ...filterSet(config) };
}
