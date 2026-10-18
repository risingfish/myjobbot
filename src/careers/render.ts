import type { TextPage } from "../http/client.js";
import type { BrowserPort, BrowserTab, RoutedRequest } from "./browser.js";
import { FetchRefused } from "./fetchPage.js";

interface RenderRequest {
    url: string;
    check: (url: string) => Promise<void>;
    seconds: number;
    maxBytes: number;
}

const BLOCKED_KINDS = new Set(["image", "font", "media"]);
const MS_PER_SECOND = 1000;
const REFUSED = "refused: the page led to an address that is not on the public internet";

/** Renders a page in the owner's browser, letting through only requests to public addresses, and returns its HTML capped in size. */
export async function renderPage(port: BrowserPort, request: RenderRequest): Promise<TextPage> {
    const deadline = Date.now() + request.seconds * MS_PER_SECOND;
    const session = await port.session({ serviceWorkers: "block", acceptDownloads: false });
    try {
        const refused = { main: false };
        await session.route(async (routed) => noteRefusedMain(refused, routed, await routeVerdict(routed, request.check)));
        await session.routeWebSockets((url) => passes(request.check, url));
        const tab = await session.open();
        await tab.goto(request.url, request.seconds * MS_PER_SECOND).catch((error: unknown) => keepOnTimeout(error, refused.main));
        return await finish(tab, request, deadline);
    } finally {
        await session.close();
    }
}

/** Decides whether one request the page makes may go out: never images, fonts or media, and only to public addresses. */
async function routeVerdict(routed: RoutedRequest, check: RenderRequest["check"]): Promise<boolean> {
    return !BLOCKED_KINDS.has(routed.kind) && (await passes(check, routed.url));
}

/** Tells whether an address passes the public-address check. */
function passes(check: RenderRequest["check"], url: string): Promise<boolean> {
    return check(url).then(
        () => true,
        () => false,
    );
}

/** Remembers that the page's own navigation was refused, so its failure can be reported as a refused fetch. */
function noteRefusedMain(refused: { main: boolean }, routed: RoutedRequest, allowed: boolean): boolean {
    if (!allowed && routed.mainNavigation) refused.main = true;
    return allowed;
}

/** Carries on with whatever has loaded when the page is only slow, and reports a refused navigation as such. */
function keepOnTimeout(error: unknown, refusedMain: boolean): void {
    if (refusedMain) throw new FetchRefused(REFUSED, { cause: error });
    if (!(error instanceof Error && error.name === "TimeoutError")) throw error;
}

/** Waits for the page to settle within the time left, checks where it ended up, and reads its HTML. */
async function finish(tab: BrowserTab, request: RenderRequest, deadline: number): Promise<TextPage> {
    await tab.settle(Math.max(0, deadline - Date.now()));
    const url = tab.url();
    await request.check(url).catch((error: unknown) => {
        throw new FetchRefused(REFUSED, { cause: error });
    });
    return { url, ...capped(await tab.content(), request.maxBytes) };
}

/** Cuts HTML to at most maxBytes of UTF-8, saying whether it was cut. */
function capped(html: string, maxBytes: number): { html: string; cut: boolean } {
    const bytes = Buffer.from(html, "utf8");
    return bytes.length <= maxBytes ? { html, cut: false } : { html: bytes.subarray(0, maxBytes).toString("utf8"), cut: true };
}
