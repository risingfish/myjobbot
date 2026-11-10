import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";
import { connectBrowser, type BrowserPort } from "../../src/careers/browser.js";
import { FetchRefused } from "../../src/careers/fetchPage.js";
import { renderPage } from "../../src/careers/render.js";

const BROWSER_URL = process.env.MYJOBBOT_TEST_BROWSER_URL;
const hits: string[] = [];
let allowed: Server;
let forbidden: Server;
let cdn: Server;
let port: BrowserPort;

function serve(handler: Parameters<typeof createServer>[1]): Promise<Server> {
    const server = createServer(handler);
    return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function base(server: Server): string {
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const SCRIPT = (forbiddenBase: string) => `document.getElementById("root").textContent = "Built by script"; fetch("${forbiddenBase}/leak").catch(() => {}); fetch("/leak-bounce").catch(() => {}); fetch("/bounce").then((answer) => answer.text()).then((text) => document.body.append(text));`;

const SOCKETS = (allowedBase: string) => ["allow", "refuse"].map((name) => `new WebSocket("${allowedBase.replace("http", "ws")}/${name}");`).join(" ");

function page(script: string): string {
    return `<html><body><div id="root"></div><script>${script}</script></body></html>`;
}

beforeAll(async () => {
    if (BROWSER_URL === undefined) return;
    forbidden = await serve((request, response) => (hits.push(request.url ?? ""), response.end("secret")));
    cdn = await serve((_request, response) => response.writeHead(200, { "access-control-allow-origin": "*" }).end("Loaded through a redirect"));
    allowed = await serve((request, response) => {
        const redirects: Record<string, string> = { "/redirect": `${base(forbidden)}/redirected`, "/leak-bounce": `${base(forbidden)}/bounced`, "/bounce": `${base(cdn)}/data` };
        if (request.url === "/hang") return;
        if (request.url === "/sockets") return void response.writeHead(200, { "content-type": "text/html" }).end(page(SOCKETS(base(allowed))));
        if (request.url === "/late") return void response.writeHead(200, { "content-type": "text/html" }).end(page(`fetch("/hang").catch(() => {});`));
        const target = redirects[request.url ?? ""];
        if (target !== undefined) return void response.writeHead(302, { location: target }).end();
        response.writeHead(200, { "content-type": "text/html" }).end(page(SCRIPT(base(forbidden))));
    });
    port = await connectBrowser(BROWSER_URL);
});

afterAll(async () => {
    await port?.close();
    allowed?.closeAllConnections();
    allowed?.close();
    forbidden?.close();
    cdn?.close();
});

async function onlyAllowed(url: string): Promise<void> {
    if (![allowed, cdn].some((server) => url.startsWith(`${base(server)}/`))) throw new FetchRefused(`refused: ${url}`);
}

test.skipIf(BROWSER_URL === undefined)("a real browser renders a script-built page and never reaches a disallowed address, directly or by a page or script redirect", async () => {
    const rendered = await renderPage(port, { url: `${base(allowed)}/`, check: onlyAllowed, seconds: 10, maxBytes: 100_000, clock: Date.now });
    expect(rendered.html).toContain("Built by script");
    expect(rendered.html).toContain("Loaded through a redirect");
    await expect(renderPage(port, { url: `${base(allowed)}/redirect`, check: onlyAllowed, seconds: 10, maxBytes: 100_000, clock: Date.now })).rejects.toBeInstanceOf(FetchRefused);
    expect(hits).toEqual([]);
});

test.skipIf(BROWSER_URL === undefined)("a request still in flight when the render ends doesn't crash the process", async () => {
    const unhandled: unknown[] = [];
    const note = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", note);
    try {
        await renderPage(port, { url: `${base(allowed)}/late`, check: onlyAllowed, seconds: 2, maxBytes: 100_000, clock: Date.now });
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    } finally {
        process.off("unhandledRejection", note);
    }
    expect(unhandled).toEqual([]);
});

test.skipIf(BROWSER_URL === undefined)("a WebSocket whose check ends after the render doesn't crash the process, whether it is let through or refused", async () => {
    const unhandled: unknown[] = [];
    const note = (reason: unknown) => unhandled.push(reason);
    const late = async (url: string) => {
        if (!url.startsWith("ws:")) return onlyAllowed(url);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        if (url.endsWith("/refuse")) throw new FetchRefused(`refused: ${url}`);
    };
    process.on("unhandledRejection", note);
    try {
        await renderPage(port, { url: `${base(allowed)}/sockets`, check: late, seconds: 1, maxBytes: 100_000, clock: Date.now });
        await new Promise((resolve) => setTimeout(resolve, 3_000));
    } finally {
        process.off("unhandledRejection", note);
    }
    expect(unhandled).toEqual([]);
});
