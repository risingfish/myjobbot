import type { PlannedSource } from "../db/sourcePlans.js";
import type { UserSourceStore } from "../db/sourceStore.js";
import { moduleFor } from "../sources/registry.js";
import { enableProblem, scheduledElsewhere, type SearchLimits } from "./sourceRules.js";

export type SwitchResult = { ok: true } | { ok: false; problem: string };

export interface SwitchDeps {
    sources: Pick<UserSourceStore, "list" | "setEnabled">;
    onForAll: () => Promise<PlannedSource[]>;
    userId: number;
    jsearch: SearchLimits;
    now: () => Date;
}

/** Turns a saved source on or off, starting its next fetch from the beginning, and refuses turning on a search the shared JSearch budget can't fit. */
export async function switchSourceOn(deps: SwitchDeps, request: { id: number; on: boolean }): Promise<SwitchResult> {
    const problem = request.on ? enableProblem(await deps.sources.list(), request.id, deps.jsearch, scheduledElsewhere(await deps.onForAll(), deps.userId)) : null;
    if (problem !== null) return { ok: false, problem };
    await deps.sources.setEnabled(request.id, request.on, deps.now().toISOString());
    return { ok: true };
}

/** Deletes a saved source, refusing one that isn't saved or belongs to the account, such as Gmail alerts. */
export async function deleteSaved(deps: { sources: Pick<UserSourceStore, "list" | "remove"> }, id: number): Promise<{ ok: boolean }> {
    const source = (await deps.sources.list()).find((saved) => saved.id === id);
    if (source === undefined || moduleFor(source.module)?.scope === "account") return { ok: false };
    await deps.sources.remove(id);
    return { ok: true };
}
