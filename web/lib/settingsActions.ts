"use server";

import { revalidatePath } from "next/cache.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import { describeError } from "../../src/errors.js";
import { saveRequest, type SaveRequest } from "../../src/web/settingsForm.js";
import { saveSection, type SaveResult } from "../../src/web/settingsSave.js";
import { getStores, runtimeSettings } from "./uiState.js";

const NOT_A_SECTION: SaveResult = { ok: false, problems: [{ field: null, entry: null, message: "not a settings section" }] };
const FAILED: SaveResult = { ok: false, failed: true };

/** Saves one section of the Settings page's search settings, checked together with the rest, for that section's Save button. */
export async function saveSettingsSection(_previous: SaveResult | null, request: unknown): Promise<SaveResult> {
    const parsed = saveRequest.safeParse(request);
    if (!parsed.success) return NOT_A_SECTION;
    try {
        return await storeSection(parsed.data);
    } catch (error) {
        console.error(`myjobbot: saving search settings failed: ${describeError(error)}`);
        return FAILED;
    }
}

/** Checks one section's save against the stored settings and config.json, then stores it whole or returns why not. */
async function storeSection(request: SaveRequest): Promise<SaveResult> {
    const { stores } = await getStores();
    const result = saveSection(await stores.searchSettings.load(OWNER_ID), runtimeSettings(), request);
    if ("problems" in result) return { ok: false, problems: result.problems };
    await stores.searchSettings.save(OWNER_ID, result.toStore, new Date().toISOString());
    revalidatePath("/settings");
    return { ok: true };
}
