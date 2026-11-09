"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import { describeError } from "../../src/errors.js";
import { recognizeLink, type RecognizedLink } from "../../src/sources/registry.js";
import { saveSource as storeSource, sourceRequest, type SourceSaveResult } from "../../src/web/saveSource.js";
import { deleteSaved, switchSourceOn, type SwitchResult } from "../../src/web/switchSource.js";
import { sourceDeps } from "./sourceDeps.js";
import { sourceConfig } from "./fileConfig.js";
import { getStores } from "./uiState.js";
import { guarded } from "./guard.js";

const sourceId = z.number().int().positive();

const NOT_A_SOURCE: SwitchResult = { ok: false, problem: "not a saved source" };

/** Turns one of the owner's saved sources on or off from its switch, starting its next fetch from the beginning, and refuses turning on a search the JSearch budget can't fit. */
async function setSourceEnabledAction(id: unknown, on: unknown): Promise<SwitchResult> {
    const request = z.object({ id: sourceId, on: z.boolean() }).safeParse({ id, on });
    if (!request.success) return NOT_A_SOURCE;
    const { stores } = await getStores();
    const deps = { sources: stores.sources, onForAll: () => stores.sourcePlans.sourcesOnForAll(), userId: stores.userId, jsearch: sourceConfig().jsearch, now: () => new Date() };
    const result = await switchSourceOn(deps, request.data);
    if (result.ok) revalidatePath("/settings");
    return result;
}

/** Deletes one of the owner's saved sources from its Delete button; its jobs keep their label, and an account source such as Gmail alerts can't be deleted. */
async function deleteSourceAction(id: unknown): Promise<{ ok: boolean }> {
    const request = sourceId.safeParse(id);
    if (!request.success) return { ok: false };
    const { stores } = await getStores();
    const result = await deleteSaved({ sources: stores.sources }, request.data);
    if (result.ok) revalidatePath("/settings");
    return result;
}

/** Finds the source type a pasted jobs page link belongs to, with its fields filled in and a name to offer, for the link box. */
async function recognizeSourceLinkAction(link: unknown): Promise<RecognizedLink | null> {
    return typeof link === "string" ? recognizeLink(link) : null;
}

/** Saves a source from its form, checked against the owner's other sources, then tests it, for the form's Save button. */
async function saveSourceAction(_previous: SourceSaveResult | null, request: unknown): Promise<SourceSaveResult> {
    const parsed = sourceRequest.safeParse(request);
    if (!parsed.success) return { ok: false, problems: [{ field: null, entry: null, message: "not a source form" }] };
    try {
        const result = await storeSource(await sourceDeps(), parsed.data);
        if (result.ok) revalidatePath("/settings");
        return result;
    } catch (error) {
        console.error(`myjobbot: saving a source failed: ${describeError(error)}`);
        return { ok: false, failed: true };
    }
}

export const setSourceEnabled = guarded(setSourceEnabledAction, {});
export const deleteSource = guarded(deleteSourceAction, {});
export const recognizeSourceLink = guarded(recognizeSourceLinkAction, {});
export const saveSource = guarded(saveSourceAction, {});
