import { z } from "zod";
import type { FileConfig } from "../../src/config/schema.js";
import type { JobViews } from "../../src/db/store.js";
import type { PageData } from "../../src/web/api.js";
import { loadPageData } from "../../src/web/pageData.js";
import { PAGE_NAMES } from "./pages.js";

export type HideResult = { ok: true } | { ok: false; error: string };

const PAGE_SIZE = 100;
const rowsRequest = z.object({ name: z.enum(PAGE_NAMES), offset: z.number().int().min(0).max(1_000_000) });
const hideChange = z.object({ ats: z.string().min(1), jobId: z.string().min(1), hidden: z.boolean() });

/** Loads one page of rows for a web UI page, refusing an unknown page or an out-of-range offset. */
export async function loadRows(views: JobViews, config: FileConfig, request: unknown): Promise<PageData> {
    const parsed = rowsRequest.safeParse(request);
    if (!parsed.success) throw new Error("Invalid page request");
    const { name, offset } = parsed.data;
    return loadPageData(name, { views, config, page: { offset, limit: PAGE_SIZE }, now: new Date() });
}

/** Hides or unhides one job, refusing a malformed change and reporting a job that doesn't exist. */
export async function setHiddenFor(views: JobViews, change: unknown): Promise<HideResult> {
    const parsed = hideChange.safeParse(change);
    if (!parsed.success) throw new Error("Invalid hide request");
    return (await views.setHidden(parsed.data)) ? { ok: true } : { ok: false, error: "No such job." };
}
