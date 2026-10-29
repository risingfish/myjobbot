import { z } from "zod";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import { fetchSources } from "../../src/sources/fetchPhase.js";
import type { ToolContext } from "../../src/tools/context.js";
import { buildTools } from "../../src/tools/registry.js";

export async function invokeTool(context: ToolContext, name: string, args: unknown): Promise<unknown> {
    const tool = buildTools(context).find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`no tool named ${name}`);
    return tool.invoke(args);
}

const pageSchema = z.looseObject({
    source: z.string(),
    total_unscored: z.number(),
    jobs: z.array(z.looseObject({ job_id: z.string() })),
});

const fetchedRuns = new WeakSet<object>();

export async function fetchRun(context: ToolContext): Promise<void> {
    if (fetchedRuns.has(context.run)) return;
    fetchedRuns.add(context.run);
    const stored = await context.saved.store.list(OWNER_ID);
    if (stored.length > 0) context.saved.list = stored;
    await fetchSources(context);
}

export async function nextPage(context: ToolContext, source: string) {
    await fetchRun(context);
    return pageSchema.parse(await invokeTool(context, "next_jobs", { source }));
}
