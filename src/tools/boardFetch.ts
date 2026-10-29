import type { Job } from "../jobs/job.js";
import { fetchAndIngest } from "../sources/ingest.js";
import type { SourceModule } from "../sources/module.js";
import { moduleFor } from "../sources/registry.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import { sourceRef, type Company, type FetchOutcome } from "./sources.js";

/** Fetches a company board's current postings through its board's source module, stores them, and logs the fetch. */
export async function fetchBoard(context: ToolContext, company: Company): Promise<FetchOutcome> {
    const board = boardModule(company);
    const seen = context.now().toISOString();
    const batch = { source: sourceRef(company), name: company.name, scope: board.scope, seen };
    const { stored } = await fetchAndIngest(context, { module: board, params: board.params.parse({ slug: company.slug }), batch });
    logBoardFetch(context, company, stored);
    return { seen, note: null };
}

/** Finds the source module for a configured company's board platform. */
function boardModule(company: Company): SourceModule<unknown> {
    const found = moduleFor(company.ats);
    if (found === null) throw new Error(`no source module for ${company.ats}`);
    return found;
}

/** Writes a board_fetch entry with the company, ATS and fetched jobs to the run's jobs log. */
function logBoardFetch(context: ToolContext, company: Company, jobs: Job[]): void {
    const { name, ats, slug } = company;
    const logged = jobs.map(withoutDescription);
    context.jobLog.write({ type: "board_fetch", source: name, company: name, ats, slug, job_count: jobs.length, jobs: logged });
}
