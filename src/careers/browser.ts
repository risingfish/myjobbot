import { chromium, type APIResponse, type BrowserContext, type Page, type Route, type WebSocketRoute } from "playwright-core";

export interface RoutedRequest {
    url: string;
    kind: string;
    mainNavigation: boolean;
}

interface SessionOptions {
    serviceWorkers?: "block";
    acceptDownloads?: false;
}

export interface BrowserTab {
    goto(url: string, timeoutMs: number): Promise<void>;
    settle(timeoutMs: number): Promise<void>;
    content(): Promise<string>;
    url(): string;
}

interface BrowserSession {
    route(decide: (request: RoutedRequest) => Promise<boolean>): Promise<void>;
    routeWebSockets(decide: (url: string) => Promise<boolean>): Promise<void>;
    open(): Promise<BrowserTab>;
    probe(url: string, timeoutMs: number): Promise<boolean>;
    close(): Promise<void>;
}

export interface BrowserPort {
    session(options: SessionOptions): Promise<BrowserSession>;
    close(): Promise<void>;
}

type Decide = (request: RoutedRequest) => Promise<boolean>;

const CONNECT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "myjobbot (+careers lookup)";

/** Connects to the owner's Playwright browser service, wrapping it in the small surface the renderer uses. */
export async function connectBrowser(wsUrl: string): Promise<BrowserPort> {
    const browser = await chromium.connect(wsUrl, { timeout: CONNECT_MS });
    return {
        session: async (options) => playwrightSession(await browser.newContext({ ...options, userAgent: USER_AGENT })),
        close: () => browser.close(),
    };
}

/** Wraps one browser context, sending every request it makes through the caller's decision. */
function playwrightSession(context: BrowserContext): BrowserSession {
    return {
        route: async (decide) => void (await context.route("**/*", (route) => routed(route, decide))),
        routeWebSockets: (decide) => context.routeWebSocket(/.*/, (socket) => socketRouted(socket, decide)),
        open: async () => playwrightTab(await context.newPage()),
        probe: (url, timeoutMs) => context.request.get(url, { timeout: timeoutMs, maxRedirects: 0 }).then(() => true, () => false),
        close: () => context.close(),
    };
}

/** Lets one request through, or aborts it, as the caller decides, never handing Chromium a redirect it would follow unchecked. */
async function routed(route: Route, decide: Decide): Promise<void> {
    const request = route.request();
    const asked = { url: request.url(), kind: request.resourceType(), mainNavigation: request.isNavigationRequest() && request.frame().parentFrame() === null };
    if (!(await decide(asked))) return route.abort("blockedbyclient");
    const response = await route.fetch({ maxRedirects: 0 });
    const next = redirectTarget(response, asked.url);
    if (next === null) return route.fulfill({ response });
    if (request.isNavigationRequest()) return route.fulfill({ status: 200, contentType: "text/html", body: `<meta http-equiv="refresh" content="0;url=${attribute(next)}">` });
    return followed(route, decide, { ...asked, url: next, mainNavigation: false });
}

/** Follows a non-navigation request's redirects here, checking every hop, and answers with the final response. */
async function followed(route: Route, decide: Decide, first: RoutedRequest): Promise<void> {
    let hop: RoutedRequest | null = first;
    for (let count = 0; hop !== null && count < MAX_REDIRECTS; count += 1) {
        if (!(await decide(hop))) return route.abort("blockedbyclient");
        const response = await route.fetch({ url: hop.url, maxRedirects: 0 });
        const next = redirectTarget(response, hop.url);
        if (next === null) return route.fulfill({ response });
        hop = { ...hop, url: next };
    }
    return route.abort("blockedbyclient");
}

/** Returns where a redirect response points, resolved against the address it answered, or null when it isn't a redirect. */
function redirectTarget(response: APIResponse, from: string): string | null {
    const location = response.headers()["location"];
    const status = response.status();
    return status >= 300 && status < 400 && location !== undefined && URL.canParse(location, from) ? new URL(location, from).href : null;
}

/** Escapes text for use inside a double-quoted HTML attribute. */
function attribute(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** Connects a page's WebSocket to its server, or closes it, as the caller decides. */
async function socketRouted(socket: WebSocketRoute, decide: (url: string) => Promise<boolean>): Promise<void> {
    if (await decide(socket.url())) socket.connectToServer();
    else await socket.close();
}

/** Wraps one page in the navigation calls the renderer uses. */
function playwrightTab(page: Page): BrowserTab {
    return {
        goto: async (url, timeoutMs) => void (await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs })),
        settle: (timeoutMs) => page.waitForLoadState("networkidle", { timeout: timeoutMs }).then(
            () => undefined,
            () => undefined,
        ),
        content: () => page.content(),
        url: () => page.url(),
    };
}
