import type { SavedSource } from "../db/sourceStore.js";
import { OWNER_ID } from "../db/searchSettingsStore.js";
import { normalizeCompany } from "../jobs/company.js";
import { moduleFor } from "../sources/registry.js";
import type { ToolContext } from "../tools/context.js";

/** Prepares the stored data before the agent starts: links any job not yet linked to its company's record, which after an upgrade is every stored job, and gives each company source's company its board as careers page. */
export async function beforeAgent(context: ToolContext): Promise<void> {
    const linked = await context.store.linkUnlinkedJobs();
    if (linked > 0) context.trace.write({ type: "companies_linked", jobs: linked });
    const at = context.now().toISOString();
    for (const source of context.saved.list) await linkBoardPage(context, source, at);
}

/** Makes a company source's board its company's careers page, and links the source to that company's record. */
async function linkBoardPage(context: ToolContext, source: SavedSource, at: string): Promise<void> {
    const module = moduleFor(source.module);
    const params = module?.params.safeParse(source.params);
    if (module?.company === undefined || params?.success !== true) return;
    const hint = module.company(params.data, source.name);
    const companyId = await context.companies.setBoardPage({ key: normalizeCompany(hint.name), name: hint.name, url: hint.careersPage }, at);
    if (source.companyId !== companyId) await context.saved.store.linkCompany({ userId: OWNER_ID, id: source.id }, companyId);
}
