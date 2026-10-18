import type { JsonGetter, JsonPoster } from "../http/client.js";
import type { BoardKind, BoardLink } from "../sources/boardLink.js";
import { fetcherFor } from "../sources/index.js";
import { searchWorkday, workdayPosting } from "../sources/workday.js";
import { assertPublic, type HostLookup } from "./fetchPage.js";
import { fitPage, type PageLink } from "./fitPage.js";
import type { PageRead } from "./readPage.js";
import type { PageKind } from "./tools.js";

type BoardHttp = JsonGetter & JsonPoster;

interface Posting {
    title: string;
    location: string | null;
    url: string;
    postingId: string;
    description: string | null;
}

type BoardCache = Map<string, Promise<Posting[]>>;

export interface BoardAccess {
    http: BoardHttp;
    cache: BoardCache;
}

interface BoardDeps {
    boards: BoardAccess;
    lookup: HostLookup;
    maxChars: number;
}

interface Shown {
    text: string;
    links: PageLink[];
    note?: string;
}

interface BoardRequest {
    url: string;
    link: BoardLink;
    kind: PageKind;
    sought: string;
}

const BOARD_NAMES: Record<BoardKind, string> = { ashby: "Ashby", greenhouse: "Greenhouse", lever: "Lever", workday: "Workday" };
const NO_LONGER_LISTED = "this posting is no longer listed";

/** Reads a job board's own data for a link, as its job list for a careers page or as one posting for a job page. */
export async function boardPage(deps: BoardDeps, request: BoardRequest): Promise<PageRead> {
    const http = checked(deps);
    const page = request.kind === "careers_page" ? listing(request, await postings(http, deps.boards.cache, request)) : posting(await findPosting(http, deps.boards.cache, request));
    const fitted = fitPage(page, { maxChars: deps.maxChars, sought: request.sought });
    return { url: request.url, ...fitted, morePages: false, source: "board", fallback: null, board: boardName(request.link), ...(page.note === undefined ? {} : { note: page.note }) };
}

/** Wraps the board client so every request it makes passes the same public-address check as a page download. */
function checked(deps: BoardDeps): BoardHttp {
    return {
        getJson: async (url, headers) => {
            await assertPublic(deps.lookup, url);
            return deps.boards.http.getJson(url, headers);
        },
        postJson: async (url, body) => {
            await assertPublic(deps.lookup, url);
            return deps.boards.http.postJson(url, body);
        },
    };
}

/** Lists a board's postings, once per board (and per Workday search) per run. */
function postings(http: BoardHttp, cache: BoardCache, request: BoardRequest): Promise<Posting[]> {
    const { link } = request;
    const key = link.kind === "workday" ? `${boardName(link)}:${request.sought}` : boardName(link);
    const cached = cache.get(key) ?? (link.kind === "workday" ? workdayPostings(http, link, request.sought) : boardPostings(http, link, link.kind));
    cache.set(key, cached);
    return cached;
}

/** Reads every posting on an Ashby, Greenhouse or Lever board through that board's job-board reader. */
async function boardPostings(http: BoardHttp, link: BoardLink, kind: Exclude<BoardKind, "workday">): Promise<Posting[]> {
    const jobs = await fetcherFor(kind)({ name: link.slug, slug: link.slug }, http);
    return jobs.map((job) => ({ title: job.title, location: job.location, url: job.url, postingId: job.jobId, description: job.description }));
}

/** Searches a Workday board for the sought title. */
async function workdayPostings(http: BoardHttp, link: BoardLink, sought: string): Promise<Posting[]> {
    return (await searchWorkday(http, workdayBoard(link), sought)).map((found) => ({ ...found, description: null }));
}

/** Finds the posting a job link names, or null when the board no longer lists it. */
async function findPosting(http: BoardHttp, cache: BoardCache, request: BoardRequest): Promise<Posting | null> {
    const { link } = request;
    if (link.postingId === null) return null;
    if (link.kind === "workday") return { ...(await workdayPosting(http, workdayBoard(link), link.postingId)), postingId: link.postingId };
    return (await postings(http, cache, request)).find((each) => each.postingId === link.postingId || each.url === request.url) ?? null;
}

/** Shows a board's postings as a careers page of numbered job links. */
function listing(request: BoardRequest, found: Posting[]): Shown {
    const links = found.map((each) => ({ text: each.location === null ? each.title : `${each.title} — ${each.location}`, url: each.url }));
    return { text: `${found.length} open jobs at ${request.link.slug} on ${BOARD_NAMES[request.link.kind]}`, links };
}

/** Shows one posting as a job page: title, location and description, or an empty page when it is gone. */
function posting(found: Posting | null): Shown {
    if (found === null) return { text: "", links: [], note: NO_LONGER_LISTED };
    const text = [found.title, found.location ?? "", "", found.description ?? ""].join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return { text, links: [] };
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
