import type { FileConfig } from "../config/schema.js";
import { parseBoardLink } from "../sources/boardLink.js";
import { boardPage, type BoardAccess } from "./boardPages.js";
import { fetchPublicPage, FetchRefused, type PageFetchDeps } from "./fetchPage.js";
import { capDescription } from "../descriptions/cap.js";
import { pageToMarkdown } from "../descriptions/toMarkdown.js";
import type { StoredDescription } from "./postingPage.js";
import type { PageRenderer } from "./renderState.js";
import { hasText } from "./session.js";
import type { PageKind } from "./tools.js";
import type { TextPage } from "../http/client.js";
import { trimPage, type TrimmedPage } from "./trim.js";

type PageSource = "html" | "board" | "rendered";

export interface PageRead extends TrimmedPage {
    source: PageSource;
    fallback: string | null;
    board: string | null;
    description: StoredDescription | null;
    note?: string;
}

interface ReadDeps {
    pages: PageFetchDeps;
    boards: BoardAccess;
    renderer: Pick<PageRenderer, "render">;
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

/** Downloads a public page and trims it, rendering it in the browser instead when the download is unreadable. */
async function plainPage(deps: ReadDeps, request: ReadRequest, fallback: string | null): Promise<PageRead> {
    const page = await fetchPublicPage(deps.pages, request.url);
    const plain = trimmed(deps, request, page);
    if (!unreadable(plain, request)) return { ...plain, source: "html", fallback, board: null, description: pageDescription(request, page.html) };
    const rendered = await deps.renderer.render(page.url);
    if ("fallback" in rendered) return { ...plain, source: "html", fallback: [fallback, rendered.fallback].filter((each) => each !== null).join(","), board: null, description: null };
    return { ...trimmed(deps, request, rendered.page), source: "rendered", fallback, board: null, description: pageDescription(request, rendered.page.html) };
}

/** Converts a job page's HTML to the Markdown description to store if the lookup finds the job there; careers pages carry none. */
function pageDescription(request: ReadRequest, html: string): StoredDescription | null {
    const markdown = request.kind === "job_page" ? pageToMarkdown(html) : null;
    return markdown === null ? null : { text: capDescription(markdown, "markdown"), format: "markdown" };
}

/** Trims fetched or rendered HTML for the model, keeping links only on careers pages. */
function trimmed(deps: ReadDeps, request: ReadRequest, page: TextPage): TrimmedPage {
    const trim = trimPage(page.html, { baseUrl: page.url, maxChars: deps.settings.page_chars, sought: request.sought, links: request.kind === "careers_page" });
    return { ...trim, cut: trim.cut || page.cut };
}

/** Tells whether a page gives the model nothing to work with: a job page with no text, or a careers page with no links. */
function unreadable(page: TrimmedPage, request: ReadRequest): boolean {
    return request.kind === "job_page" ? !hasText(page.text) : page.links.length === 0;
}
