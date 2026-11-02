"use server";

import { describeError } from "../../src/errors.js";
import type { JobDetailView, PageData, PageName, RescoreResult } from "../../src/web/api.js";
import { loadDetailsFor, loadRows, rescoreFor, setAppliedFor, setHiddenFor, type AppliedResult, type HideResult } from "./rows.js";
import { getStores, getUiState } from "./uiState.js";

/** Loads the next rows of a page for the browser as the owner scrolls. */
export async function loadMoreRows(name: PageName, offset: number): Promise<PageData> {
    const { views, config, sourceNames } = await getUiState();
    return loadRows(views, { config, sourceNames }, { name, offset });
}

/** Saves the owner hiding or unhiding a job from the browser. */
export async function setJobHidden(ats: string, jobId: string, hidden: boolean): Promise<HideResult> {
    return setHiddenFor((await getUiState()).views, { ats, jobId, hidden });
}

/** Saves the owner marking a job applied, or clearing the mark, from the browser, at the server's time. */
export async function setJobApplied(ats: string, jobId: string, applied: boolean): Promise<AppliedResult> {
    return setAppliedFor((await getUiState()).views, { ats, jobId, applied }, new Date());
}

/** Loads one job's details for the browser when its panel opens. */
export async function loadJobDetails(ats: string, jobId: string): Promise<JobDetailView | null> {
    const { views, config } = await getUiState();
    return loadDetailsFor(views, config, { ats, jobId });
}

/** Re-scores one job at once from its panel, answering failed, with the detail in the server log only, when it can't be run. */
export async function rescoreJob(ats: string, jobId: string): Promise<RescoreResult> {
    try {
        return await rescoreFor((await getStores()).stores, process.env, { ats, jobId });
    } catch (error) {
        console.error(`rescore failed: ${describeError(error)}`);
        return { outcome: "failed" };
    }
}
