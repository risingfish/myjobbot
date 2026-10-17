import type { FileConfig } from "../config/schema.js";
import { fetchPublicPage, type PageFetchDeps } from "./fetchPage.js";
import type { PageKind } from "./tools.js";
import { trimPage, type TrimmedPage } from "./trim.js";

type PageSource = "html" | "board" | "rendered";

export interface PageRead extends TrimmedPage {
    source: PageSource;
    fallback: string | null;
    board: string | null;
}

interface ReadDeps {
    pages: PageFetchDeps;
    settings: Pick<FileConfig["careers_lookup"], "page_chars">;
}

interface ReadRequest {
    url: string;
    kind: PageKind;
    sought: string;
}

/** Reads one page for the lookup and trims it for the model, saying how it was read. */
export async function readPage(deps: ReadDeps, request: ReadRequest): Promise<PageRead> {
    const page = await fetchPublicPage(deps.pages, request.url);
    const trimmed = trimPage(page.html, { baseUrl: page.url, maxChars: deps.settings.page_chars, sought: request.sought, links: request.kind === "careers_page" });
    return { ...trimmed, cut: trimmed.cut || page.cut, source: "html", fallback: null, board: null };
}
