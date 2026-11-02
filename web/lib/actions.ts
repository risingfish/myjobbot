"use server";

import { after } from "next/server.js";
import { describeError } from "../../src/errors.js";
import { openRescore } from "../../src/rescore/open.js";
import type { JobDetailView, PageData, PageName, RescoreStart } from "../../src/web/api.js";
import { loadDetailsFor, loadRows, setAppliedFor, startRescoreFor, setHiddenFor, type AppliedResult, type HideResult } from "./rows.js";
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

/** Starts one job's re-score from its panel and answers with its run at once, the re-score carrying on after the answer; failed, with the detail in the server log only, when it can't start. */
export async function startRescore(ats: string, jobId: string): Promise<RescoreStart> {
    try {
        const { stores } = await getStores();
        const started = await startRescoreFor(() => openRescore(process.env, stores), { ats, jobId });
        if ("work" in started) after(() => started.work().catch((error: unknown) => console.error(`rescore failed: ${describeError(error)}`)));
        return "run" in started ? { run: started.run } : started;
    } catch (error) {
        console.error(`rescore failed: ${describeError(error)}`);
        return { failed: true };
    }
}
