import { z } from "zod";
import { OWNER_ID } from "../db/searchSettingsStore.js";
import type { SavedSource, SourceStore } from "../db/sourceStore.js";
import { testFetch, type TestDeps, type TestOutcome } from "../sources/testFetch.js";
import type { Problem } from "./settingsProblems.js";
import { isScheduled, saveSourcePlan, type SaveFacts } from "./sourceRules.js";

export type SourceSaveResult = { ok: true; test: TestOutcome } | { ok: false; problems: Problem[] } | { ok: false; failed: true };

export interface SaveSourceDeps {
    store: SourceStore;
    facts: Omit<SaveFacts, "saved">;
    test: Omit<TestDeps, "at">;
    now: () => Date;
}

export const sourceRequest = z.object({
    id: z.number().int().positive().nullable(),
    module: z.string().min(1),
    name: z.string(),
    values: z.record(z.string(), z.union([z.string(), z.boolean()])),
});

/** Saves a source from its form once the rules across sources allow it, then tests it; a failing test is recorded so the source shows as failing until a fetch works. */
export async function saveSource(deps: SaveSourceDeps, request: z.infer<typeof sourceRequest>): Promise<SourceSaveResult> {
    const plan = saveSourcePlan(request, { ...deps.facts, saved: await deps.store.list(OWNER_ID) });
    if ("problems" in plan) return { ok: false, problems: plan.problems };
    const at = deps.now().toISOString();
    const stored = await deps.store.save(OWNER_ID, plan.source, at);
    const test = await testFetch(stored, { ...deps.test, at });
    await recordTest(deps.store, stored, { at, test });
    return { ok: true, test };
}

/** Records a test as the source's last fetch, except a passing test of a scheduled search, whose jobs weren't stored, so the next run still fetches it. */
async function recordTest(store: SourceStore, source: SavedSource, done: { at: string; test: TestOutcome }): Promise<void> {
    const { test } = done;
    if (test.ok && isScheduled(source.module)) return;
    const outcome = test.ok ? { outcome: "ok" as const, jobs: test.jobs, reason: null } : { outcome: "failing" as const, jobs: 0, reason: test.reason };
    await store.recordFetch({ userId: OWNER_ID, id: source.id }, { at: done.at, cost: 0, ...outcome }, null);
}
