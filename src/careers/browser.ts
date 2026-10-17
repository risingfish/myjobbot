import { chromium, type BrowserContext, type Page, type Route, type WebSocketRoute } from "playwright-core";

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

const CONNECT_MS = 10_000;
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

/** Lets one request through without following its redirects, so each redirect comes back here as a request of its own, or aborts it. */
async function routed(route: Route, decide: (request: RoutedRequest) => Promise<boolean>): Promise<void> {
    const request = route.request();
    const mainNavigation = request.isNavigationRequest() && request.frame().parentFrame() === null;
    if (!(await decide({ url: request.url(), kind: request.resourceType(), mainNavigation }))) return route.abort("blockedbyclient");
    const response = await route.fetch({ maxRedirects: 0 });
    return route.fulfill({ response });
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
