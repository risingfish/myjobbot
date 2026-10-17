import type { FileConfig } from "../config/schema.js";
import { parseBoardLink } from "../sources/boardLink.js";
import { boardPage, type BoardAccess } from "./boardPages.js";
import { fetchPublicPage, FetchRefused, type PageFetchDeps } from "./fetchPage.js";
import type { PageKind } from "./tools.js";
import { trimPage, type TrimmedPage } from "./trim.js";

type PageSource = "html" | "board" | "rendered";

export interface PageRead extends TrimmedPage {
    source: PageSource;
    fallback: string | null;
    board: string | null;
    note?: string;
}

interface ReadDeps {
    pages: PageFetchDeps;
    boards: BoardAccess;
    settings: Pick<FileConfig["careers_lookup"], "page_chars">;
}

interface ReadRequest {
    url: string;
    kind: PageKind;
    sought: string;
}

/** Reads one page for the lookup and trims it for the model: from a job board's data when it has some, otherwise by download. */
export async function readPage(deps: ReadDeps, request: ReadRequest): Promise<PageRead> {
    const link = parseBoardLink(request.url);
    if (link === null) return plainPage(deps, request, null);
    const read = await boardPage({ boards: deps.boards, lookup: deps.pages.lookup, maxChars: deps.settings.page_chars }, { ...request, link }).catch(unlessRefused);
    return read ?? plainPage(deps, request, "board_failed");
}

/** Lets an address refusal through and turns any other board failure into "no board page", so the download is tried. */
function unlessRefused(error: unknown): null {
    if (error instanceof FetchRefused) throw error;
    return null;
}

/** Downloads a public page and trims it, keeping links only on careers pages. */
async function plainPage(deps: ReadDeps, request: ReadRequest, fallback: string | null): Promise<PageRead> {
    const page = await fetchPublicPage(deps.pages, request.url);
    const trimmed = trimPage(page.html, { baseUrl: page.url, maxChars: deps.settings.page_chars, sought: request.sought, links: request.kind === "careers_page" });
    return { ...trimmed, cut: trimmed.cut || page.cut, source: "html", fallback, board: null };
}
