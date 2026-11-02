import { z } from "zod";
import type { Environment } from "../../src/config/load.js";
import type { Settings } from "../../src/config/schema.js";
import type { JobKey, JobViews, Stores } from "../../src/db/store.js";
import { openRescore } from "../../src/rescore/open.js";
import { rescore } from "../../src/rescore/rescore.js";
import type { JobDetailView, JobRowView, PageData, RescoreResult } from "../../src/web/api.js";
import { toJobDetailView } from "../../src/web/jobDetail.js";
import { loadPageData, rowContext, type PageSettings } from "../../src/web/pageData.js";
import { toJobRowView } from "../../src/web/rowViews.js";
import { PAGE_NAMES } from "./pages.js";

export type HideResult = { ok: true } | { ok: false; error: string };
export type AppliedResult = { ok: true; appliedOn: string | null } | { ok: false; error: string };

const PAGE_SIZE = 100;
const rowsRequest = z.object({ name: z.enum(PAGE_NAMES), offset: z.number().int().min(0).max(1_000_000) });
const jobRequest = z.object({ ats: z.string().min(1).max(32), jobId: z.string().min(1).max(255) });
const jobChange = z.object({ ats: z.string().min(1), jobId: z.string().min(1) });
const hideChange = jobChange.extend({ hidden: z.boolean() });
const appliedChange = jobChange.extend({ applied: z.boolean() });

/** Loads one page of rows for a web UI page, refusing an unknown page or an out-of-range offset. */
export async function loadRows(views: JobViews, settings: PageSettings, request: unknown): Promise<PageData> {
    const parsed = rowsRequest.safeParse(request);
    if (!parsed.success) throw new Error("Invalid page request");
    const { name, offset } = parsed.data;
    return loadPageData(name, { views, ...settings, page: { offset, limit: PAGE_SIZE }, now: new Date() });
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

/** Loads one job's details for its panel, refusing a malformed request and giving null for a job that doesn't exist. */
export async function loadDetailsFor(views: JobViews, config: Settings, request: unknown): Promise<JobDetailView | null> {
    const parsed = jobRequest.safeParse(request);
    if (!parsed.success) throw new Error("Invalid job request");
    const [row, verdicts] = await Promise.all([views.jobDetail(parsed.data), views.jobVerdicts(parsed.data)]);
    return row === null ? null : toJobDetailView(row, verdicts, rowContext(config, new Date()));
}

/** Re-scores one job at once for its panel, refusing a malformed request before any model call, and answers with the job's refreshed row unless the re-score failed. */
export async function rescoreFor(stores: Stores, environment: Environment, request: unknown): Promise<RescoreResult> {
    const parsed = jobRequest.safeParse(request);
    if (!parsed.success) return { outcome: "failed" };
    const opened = await openRescore(environment, stores);
    try {
        const result = await rescore(opened.deps, parsed.data);
        return result.outcome === "failed" ? result : { ...result, row: await refreshedRow(stores.jobViews, opened.deps.config.settings, parsed.data) };
    } finally {
        await opened.close();
    }
}

/** Rebuilds a job's list row after a re-score, so the list and the panel show its new score or its filter note. */
async function refreshedRow(views: JobViews, config: Settings, key: JobKey): Promise<JobRowView> {
    const row = await views.jobDetail(key);
    if (row === null) throw new Error("No such job.");
    return toJobRowView(row, rowContext(config, new Date()));
}
