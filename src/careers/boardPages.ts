import type { BoardLink } from "../sources/boardLink.js";
import type { BoardPosting, SourceHttp, SourceModule } from "../sources/module.js";
import { moduleFor } from "../sources/registry.js";
import { sourceHttp } from "../sources/sourceHttp.js";
import type { HostLookup } from "./fetchPage.js";
import { fitPage } from "./fitPage.js";
import { postingPage, type Shown } from "./postingPage.js";
import type { PageRead } from "./readPage.js";
import type { PageKind } from "./tools.js";

type BoardCache = Map<string, Promise<BoardPosting[]>>;

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

interface Board {
    module: SourceModule<unknown>;
    params: unknown;
    http: SourceHttp;
}

/** Reads a job board's own data for a link, as its job list for a careers page or as one posting for a job page. */
export async function boardPage(deps: BoardDeps, request: BoardRequest): Promise<PageRead> {
    const board = { ...boardFor(request), http: sourceHttp({ http: deps.boards.http, lookup: deps.lookup }) };
    const page = request.kind === "careers_page" ? listing(board, request, await postings(board, deps.boards.cache, request)) : postingPage(await findPosting(board, deps.boards.cache, request));
    const fitted = fitPage(page, { maxChars: deps.maxChars, sought: request.sought });
    const read = { url: request.url, ...fitted, morePages: false, source: "board" as const, fallback: null, board: boardName(request.link), description: page.description };
    return page.note === undefined ? read : { ...read, note: page.note };
}

/** Finds the source module that reads a link's board, with the board's fields taken from the link. */
function boardFor(request: BoardRequest): Omit<Board, "http"> {
    const module = moduleFor(request.link.kind);
    const params = module?.fromUrl?.(new URL(request.url)) ?? null;
    if (module === null || params === null) throw new Error(`no source module reads ${boardName(request.link)}`);
    return { module, params };
}

/** Lists a board's postings, once per board (and per search, for a board that searches) per run. */
function postings(board: Board, cache: BoardCache, request: BoardRequest): Promise<BoardPosting[]> {
    const searches = board.module.postings?.search !== undefined;
    const key = searches ? `${boardName(request.link)}:${request.sought}` : boardName(request.link);
    const cached = cache.get(key) ?? readPostings(board, request.sought);
    cache.set(key, cached);
    return cached;
}

/** Reads a board's postings, searching for the sought title where the board searches and listing them all otherwise. */
function readPostings({ module, params, http }: Board, sought: string): Promise<BoardPosting[]> {
    if (module.postings?.search !== undefined) return module.postings.search(params, sought, http);
    if (module.postings?.list !== undefined) return module.postings.list(params, http);
    throw new Error(`the ${module.id} module lists no postings`);
}

/** Finds the posting a job link names, or null when the board no longer lists it. */
async function findPosting(board: Board, cache: BoardCache, request: BoardRequest): Promise<BoardPosting | null> {
    const { postingId } = request.link;
    if (postingId === null) return null;
    if (board.module.postings?.one !== undefined) return board.module.postings.one(board.params, postingId, board.http);
    return (await postings(board, cache, request)).find((each) => each.postingId === postingId || each.url === request.url) ?? null;
}

/** Shows a board's postings as a careers page of numbered job links. */
function listing(board: Board, request: BoardRequest, found: BoardPosting[]): Shown {
    const links = found.map((each) => ({ text: each.location === null ? each.title : `${each.title} — ${each.location}`, url: each.url }));
    return { text: `${found.length} open jobs at ${request.link.slug} on ${board.module.name}`, links, description: null };
}

/** Names a board for the audit log, as kind:slug (kind:tenant/site for Workday). */
function boardName(link: BoardLink): string {
    return link.kind === "workday" ? `workday:${link.slug}/${link.site ?? ""}` : `${link.kind}:${link.slug}`;
}
