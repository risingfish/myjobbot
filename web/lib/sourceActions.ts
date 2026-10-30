"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import { describeError } from "../../src/errors.js";
import { moduleFor, recognizeLink, type RecognizedLink } from "../../src/sources/registry.js";
import { saveSource as storeSource, sourceRequest, type SourceSaveResult } from "../../src/web/saveSource.js";
import { enableProblem } from "../../src/web/sourceRules.js";
import { sourceDeps } from "./sourceDeps.js";
import { getStores, sourceConfig } from "./uiState.js";

export type SwitchResult = { ok: true } | { ok: false; problem: string };

const sourceId = z.number().int().positive();

const NOT_A_SOURCE: SwitchResult = { ok: false, problem: "not a saved source" };

/** Turns one of the owner's saved sources on or off from its switch, starting its next fetch from the beginning, and refuses turning on a search the JSearch budget can't fit. */
export async function setSourceEnabled(id: unknown, on: unknown): Promise<SwitchResult> {
    const request = z.object({ id: sourceId, on: z.boolean() }).safeParse({ id, on });
    if (!request.success) return NOT_A_SOURCE;
    const { stores } = await getStores();
    const problem = request.data.on ? enableProblem(await stores.sources.list(OWNER_ID), request.data.id, sourceConfig().jsearch) : null;
    if (problem !== null) return { ok: false, problem };
    await stores.sources.setEnabled({ userId: OWNER_ID, id: request.data.id }, request.data.on, new Date().toISOString());
    revalidatePath("/settings");
    return { ok: true };
}

/** Deletes one of the owner's saved sources from its Delete button; its jobs keep their label, and an account source such as Gmail alerts can't be deleted. */
export async function deleteSource(id: unknown): Promise<{ ok: boolean }> {
    const request = sourceId.safeParse(id);
    if (!request.success) return { ok: false };
    const { stores } = await getStores();
    const source = (await stores.sources.list(OWNER_ID)).find((saved) => saved.id === request.data);
    if (source === undefined || moduleFor(source.module)?.scope === "account") return { ok: false };
    await stores.sources.remove({ userId: OWNER_ID, id: request.data });
    revalidatePath("/settings");
    return { ok: true };
}

/** Finds the source type a pasted jobs page link belongs to, with its fields filled in and a name to offer, for the link box. */
export async function recognizeSourceLink(link: unknown): Promise<RecognizedLink | null> {
    return typeof link === "string" ? recognizeLink(link) : null;
}

/** Saves a source from its form, checked against the owner's other sources, then tests it, for the form's Save button. */
export async function saveSource(_previous: SourceSaveResult | null, request: unknown): Promise<SourceSaveResult> {
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
