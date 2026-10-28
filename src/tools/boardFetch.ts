import type { Job } from "../jobs/job.js";
import { readAll, type SourceModule } from "../sources/module.js";
import { moduleFor } from "../sources/registry.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import type { Company, FetchOutcome } from "./sources.js";

/** Fetches a company board's current postings through its board's source module, stores them, and logs the fetch. */
export async function fetchBoard(context: ToolContext, company: Company): Promise<FetchOutcome> {
    const board = boardModule(company);
    const jobs = await readAll(board, board.params.parse({ slug: company.slug }), { http: context.sources, sourceName: company.name });
    logBoardFetch(context, company, jobs);
    const seen = context.now().toISOString();
    await context.store.upsertAll(jobs, seen, company.name);
    return { seen, note: null };
}

/** Gives the public address of a configured company's job board, which serves as its careers page. */
export function boardCareersPage(company: Company): string {
    const board = boardModule(company);
    const hint = board.company?.(board.params.parse({ slug: company.slug }), company.name);
    if (hint === undefined) throw new Error(`the ${company.ats} module names no company`);
    return hint.careersPage;
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
