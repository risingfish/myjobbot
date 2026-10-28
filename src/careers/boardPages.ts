import type { BoardKind, BoardLink } from "../sources/boardLink.js";
import { readAll, type SourceHttp } from "../sources/module.js";
import { moduleFor } from "../sources/registry.js";
import { sourceHttp } from "../sources/sourceHttp.js";
import { searchWorkday, workdayPosting } from "../sources/workday.js";
import type { HostLookup } from "./fetchPage.js";
import { fitPage } from "./fitPage.js";
import { postingPage, type Posting, type Shown } from "./postingPage.js";
import type { PageRead } from "./readPage.js";
import type { PageKind } from "./tools.js";

type BoardCache = Map<string, Promise<Posting[]>>;

export interface BoardAccess {
    http: SourceHttp;
    cache: BoardCache;
}

interface BoardDeps {
    boards: BoardAccess;
    lookup: HostLookup;
    maxChars: number;
}

interface BoardRequest {
    url: string;
    link: BoardLink;
    kind: PageKind;
    sought: string;
}

const BOARD_NAMES: Record<BoardKind, string> = { ashby: "Ashby", greenhouse: "Greenhouse", lever: "Lever", workday: "Workday" };

/** Reads a job board's own data for a link, as its job list for a careers page or as one posting for a job page. */
export async function boardPage(deps: BoardDeps, request: BoardRequest): Promise<PageRead> {
    const http = sourceHttp({ http: deps.boards.http, lookup: deps.lookup });
    const page = request.kind === "careers_page" ? listing(request, await postings(http, deps.boards.cache, request)) : postingPage(await findPosting(http, deps.boards.cache, request));
    const fitted = fitPage(page, { maxChars: deps.maxChars, sought: request.sought });
    const read = { url: request.url, ...fitted, morePages: false, source: "board" as const, fallback: null, board: boardName(request.link), description: page.description };
    return page.note === undefined ? read : { ...read, note: page.note };
}

/** Lists a board's postings, once per board (and per Workday search) per run. */
function postings(http: SourceHttp, cache: BoardCache, request: BoardRequest): Promise<Posting[]> {
    const { link } = request;
    const key = link.kind === "workday" ? `${boardName(link)}:${request.sought}` : boardName(link);
    const cached = cache.get(key) ?? (link.kind === "workday" ? workdayPostings(http, link, request.sought) : boardPostings(http, link, link.kind));
    cache.set(key, cached);
    return cached;
}

/** Reads every posting on an Ashby, Greenhouse or Lever board through that board's job-board reader. */
async function boardPostings(http: SourceHttp, link: BoardLink, kind: Exclude<BoardKind, "workday">): Promise<Posting[]> {
    const board = moduleFor(kind);
    if (board === null) throw new Error(`no source module for ${kind}`);
    const jobs = await readAll(board, board.params.parse({ slug: link.slug }), { http, sourceName: link.slug });
    return jobs.map((job) => ({ title: job.title, location: job.location, url: job.url, postingId: job.jobId, description: job.description, format: job.descriptionFormat }));
}

/** Searches a Workday board for the sought title. */
async function workdayPostings(http: SourceHttp, link: BoardLink, sought: string): Promise<Posting[]> {
    return (await searchWorkday(http, workdayBoard(link), sought)).map((found) => ({ ...found, description: null, format: "text" as const }));
}

/** Finds the posting a job link names, or null when the board no longer lists it. */
async function findPosting(http: SourceHttp, cache: BoardCache, request: BoardRequest): Promise<Posting | null> {
    const { link } = request;
    if (link.postingId === null) return null;
    if (link.kind === "workday") return { ...(await workdayPosting(http, workdayBoard(link), link.postingId)), postingId: link.postingId };
    return (await postings(http, cache, request)).find((each) => each.postingId === link.postingId || each.url === request.url) ?? null;
}

/** Shows a board's postings as a careers page of numbered job links. */
function listing(request: BoardRequest, found: Posting[]): Shown {
    const links = found.map((each) => ({ text: each.location === null ? each.title : `${each.title} — ${each.location}`, url: each.url }));
    return { text: `${found.length} open jobs at ${request.link.slug} on ${BOARD_NAMES[request.link.kind]}`, links, description: null };
}

/** Names a board for the audit log, as kind:slug (kind:tenant/site for Workday). */
function boardName(link: BoardLink): string {
    return link.kind === "workday" ? `workday:${link.slug}/${link.site ?? ""}` : `${link.kind}:${link.slug}`;
}

/** Narrows a Workday link to the parts Workday's data addresses need. */
function workdayBoard(link: BoardLink): { host: string; slug: string; site: string } {
    if (link.host === undefined || link.site === undefined) throw new Error("incomplete Workday link");
    return { host: link.host, slug: link.slug, site: link.site };
}
