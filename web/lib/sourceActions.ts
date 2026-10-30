"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import { moduleFor } from "../../src/sources/registry.js";
import { enableProblem } from "../../src/web/sourceRules.js";
import { getStores, sourceLimits } from "./uiState.js";

export type SwitchResult = { ok: true } | { ok: false; problem: string };

const sourceId = z.number().int().positive();

const NOT_A_SOURCE: SwitchResult = { ok: false, problem: "not a saved source" };

/** Turns one of the owner's saved sources on or off from its switch, starting its next fetch from the beginning, and refuses turning on a search the JSearch budget can't fit. */
export async function setSourceEnabled(id: unknown, on: unknown): Promise<SwitchResult> {
    const request = z.object({ id: sourceId, on: z.boolean() }).safeParse({ id, on });
    if (!request.success) return NOT_A_SOURCE;
    const { stores } = await getStores();
    const problem = request.data.on ? enableProblem(await stores.sources.list(OWNER_ID), request.data.id, sourceLimits()) : null;
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
