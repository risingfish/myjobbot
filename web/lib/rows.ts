import { z } from "zod";
import type { Settings } from "../../src/config/schema.js";
import type { RescoreLogStore } from "../../src/db/rescoreLogStore.js";
import type { JobViews } from "../../src/db/jobViews.js";
import type { JobDetailView, PageData } from "../../src/web/api.js";
import { toJobDetailView } from "../../src/web/jobDetail.js";
import { loadPageData, rowContext, type PageSettings } from "../../src/web/pageData.js";
import { PAGE_NAMES } from "./pages.js";

export type HideResult = { ok: true } | { ok: false; error: string };
interface DetailStores {
    views: JobViews;
    rescoreLog: RescoreLogStore;
}

export type AppliedResult = { ok: true; appliedOn: string | null } | { ok: false; error: string };

const PAGE_SIZE = 100;
const rowsRequest = z.object({ name: z.enum(PAGE_NAMES), offset: z.number().int().min(0).max(1_000_000) });
export const jobRequest = z.object({ ats: z.string().min(1).max(32), jobId: z.string().min(1).max(255) });
const jobChange = z.object({ ats: z.string().min(1), jobId: z.string().min(1) });
const hideChange = jobChange.extend({ hidden: z.boolean() });
const appliedChange = jobChange.extend({ applied: z.boolean() });

/** Loads one page of rows for a web UI page as of a given time, refusing an unknown page or an out-of-range offset. */
export async function loadRows(views: JobViews, settings: PageSettings, request: unknown, now: Date): Promise<PageData> {
    const parsed = rowsRequest.safeParse(request);
    if (!parsed.success) throw new Error("Invalid page request");
    const { name, offset } = parsed.data;
    return loadPageData(name, { views, ...settings, page: { offset, limit: PAGE_SIZE }, now });
}

/** Hides or unhides one job, refusing a malformed change and reporting a job that doesn't exist. */
export async function setHiddenFor(views: JobViews, change: unknown): Promise<HideResult> {
    const parsed = hideChange.safeParse(change);
    if (!parsed.success) throw new Error("Invalid hide request");
    return (await views.setHidden(parsed.data)) ? { ok: true } : { ok: false, error: "No such job." };
}

/** Marks one job applied at the given time or clears its mark, refusing a malformed change and reporting a job that doesn't exist. */
export async function setAppliedFor(views: JobViews, change: unknown, now: Date): Promise<AppliedResult> {
    const parsed = appliedChange.safeParse(change);
    if (!parsed.success) throw new Error("Invalid applied request");
    const saved = await views.setApplied({ ...parsed.data, at: now.toISOString() });
    return saved === null ? { ok: false, error: "No such job." } : { ok: true, appliedOn: saved.appliedOn };
}

/** Loads one job's details, with its re-scores, for its panel as of a given time, refusing a malformed request and giving null for a job that doesn't exist. */
export async function loadDetailsFor({ views, rescoreLog }: DetailStores, config: Settings, request: unknown, now: Date): Promise<JobDetailView | null> {
    const parsed = jobRequest.safeParse(request);
    if (!parsed.success) throw new Error("Invalid job request");
    const [row, verdicts, runs] = await Promise.all([views.jobDetail(parsed.data), views.jobVerdicts(parsed.data), rescoreLog.runsFor(parsed.data)]);
    return row === null ? null : toJobDetailView(row, { verdicts, runs }, rowContext(config, now));
}
