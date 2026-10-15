"use server";

import type { PageData, PageName } from "../../src/web/api.js";
import { loadRows, setHiddenFor, type HideResult } from "./rows.js";
import { getUiState } from "./uiState.js";

/** Loads the next rows of a page for the browser as the owner scrolls. */
export async function loadMoreRows(name: PageName, offset: number): Promise<PageData> {
    const { views, config } = await getUiState();
    return loadRows(views, config, { name, offset });
}

/** Saves the owner hiding or unhiding a job from the browser. */
export async function setJobHidden(ats: string, jobId: string, hidden: boolean): Promise<HideResult> {
    return setHiddenFor((await getUiState()).views, { ats, jobId, hidden });
}
