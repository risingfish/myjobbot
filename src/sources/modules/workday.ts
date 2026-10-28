import { createHash } from "node:crypto";
import { z } from "zod";
import { capDescription } from "../../descriptions/cap.js";
import { htmlToMarkdown } from "../../descriptions/toMarkdown.js";
import { makeJob, type Job } from "../../jobs/job.js";
import { parseBoardLink, WORKDAY_HOST } from "../boardLink.js";
import { optionalText } from "../fields.js";
import type { BoardPosting, SourceContext, SourceHttp, SourceModule, SourcePage } from "../module.js";

interface WorkdaySite {
    host: string;
    tenant: string;
    site: string;
}

const PAGE_SIZE = 20;
const MAX_JOB_ID = 255;
const JOB_PATH = /^\/job\/[^?#]+$/;

const params = z.object({ host: z.string().regex(WORKDAY_HOST), tenant: z.string().min(1), site: z.string().min(1) });
const cursor = z.object({ offset: z.number().int().nonnegative() });
const searchAnswer = z.object({ jobPostings: z.array(z.object({ title: z.string(), externalPath: z.string().regex(JOB_PATH), locationsText: optionalText })) });
const postingAnswer = z.object({ jobPostingInfo: z.object({ title: z.string(), jobDescription: optionalText, location: optionalText }) });

export const workday: SourceModule<WorkdaySite> = {
    id: "workday",
    name: "Workday",
    description: "A company's jobs site on Workday.",
    kind: "ats",
    scope: "company",
    params,
    fields: [
        { name: "host", label: "Workday host", input: "text", placeholder: "acme.wd5.myworkdayjobs.com" },
        { name: "tenant", label: "Tenant", input: "text" },
        { name: "site", label: "Site", input: "text" },
    ],
    requires: [],
    limits: { maxJobsPerRun: 100, refresh: "every_run" },
    fromUrl: (url) => siteParams(url),
    suggestName: ({ tenant }) => tenant.charAt(0).toUpperCase() + tenant.slice(1),
    target: ({ host, site }) => `workday:${host}/${site}`.toLowerCase(),
    company: (site, name) => ({ name, careersPage: pageUrl(site, "") }),
    fetch: (site, ctx, from) => sitePages(site, ctx, cursor.safeParse(from).data?.offset ?? 0),
    postings: {
        search: (site, text, http) => listPage(http, site, { offset: 0, searchText: text }),
        one: (site, path, http) => readPosting(http, site, path),
    },
};

/** Gives the jobs site a pasted Workday link names, or null when it isn't a Workday link. */
function siteParams(url: URL): WorkdaySite | null {
    const link = parseBoardLink(url.href);
    if (link?.kind !== "workday" || link.host === undefined || link.site === undefined) return null;
    return { host: link.host, tenant: link.slug, site: link.site };
}

/** Yields a jobs site's postings 20 to a page from an offset, each page saying where the next one starts. */
async function* sitePages(site: WorkdaySite, ctx: SourceContext, start: number): AsyncGenerator<SourcePage> {
    for (let offset = start; ; offset += PAGE_SIZE) {
        const listed = await listPage(ctx.http, site, { offset, searchText: "" });
        const jobs: Job[] = [];
        for (const posting of listed) jobs.push(siteJob(site, ctx.sourceName, await readPosting(ctx.http, site, posting.postingId)));
        const next = listed.length < PAGE_SIZE ? null : { offset: offset + PAGE_SIZE };
        yield { jobs, cost: 0, next };
        if (next === null) return;
    }
}

/** Lists one page of a site's postings, optionally only those matching a search. */
async function listPage(http: SourceHttp, site: WorkdaySite, page: { offset: number; searchText: string }): Promise<BoardPosting[]> {
    const answer = searchAnswer.parse(await http.postJson(`${dataBase(site)}/jobs`, { appliedFacets: {}, limit: PAGE_SIZE, ...page }));
    return answer.jobPostings.map((posting) => ({ title: posting.title, location: posting.locationsText, url: pageUrl(site, posting.externalPath), postingId: posting.externalPath, description: null, format: "text" }));
}

/** Reads one posting from its job path, with its raw HTML description as Markdown within the stored limit, or none when it is blank. */
async function readPosting(http: SourceHttp, site: WorkdaySite, path: string): Promise<BoardPosting> {
    if (!JOB_PATH.test(path) || path.includes("/../")) throw new Error(`${path} is not a Workday job path`);
    const { jobPostingInfo: info } = postingAnswer.parse(await http.getJson(`${dataBase(site)}${path}`));
    const markdown = htmlToMarkdown(info.jobDescription ?? "");
    return { title: info.title, location: info.location, url: pageUrl(site, path), postingId: path, description: markdown === null ? null : capDescription(markdown, "markdown"), format: "markdown" };
}

/** Turns a posting read from a site into the shared Job record, under the source's company name. */
function siteJob(site: WorkdaySite, company: string, posting: BoardPosting): Job {
    const core = { ats: "workday" as const, jobId: jobIdFor(site, posting.postingId), company, title: posting.title, url: posting.url };
    return makeJob(core, { location: posting.location, description: posting.description, descriptionFormat: "markdown" });
}

/** Names a posting uniquely across Workday sites, as tenant/site/posting, or by its digest when that is too long to store. */
function jobIdFor(site: WorkdaySite, path: string): string {
    const id = `${site.tenant}/${site.site}/${path.split("/").at(-1) ?? ""}`;
    return id.length > MAX_JOB_ID ? createHash("sha256").update(id).digest("hex") : id;
}

/** Builds the address of a site's public data. */
function dataBase(site: WorkdaySite): string {
    return `https://${site.host}/wday/cxs/${encodeURIComponent(site.tenant)}/${encodeURIComponent(site.site)}`;
}

/** Builds the address a person would open for a posting, or for the site itself. */
function pageUrl(site: WorkdaySite, path: string): string {
    return `https://${site.host}/${encodeURIComponent(site.site)}${path}`;
}
