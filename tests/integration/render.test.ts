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

const SCRIPT = (forbiddenBase: string) =>
    `document.getElementById("root").textContent = "Built by script"; fetch("${forbiddenBase}/leak").catch(() => {}); fetch("/leak-bounce").catch(() => {}); fetch("/bounce").then((answer) => answer.text()).then((text) => document.body.append(text));`;

function page(script: string): string {
    return `<html><body><div id="root"></div><script>${script}</script></body></html>`;
}

beforeAll(async () => {
    if (BROWSER_URL === undefined) return;
    forbidden = await serve((request, response) => (hits.push(request.url ?? ""), response.end("secret")));
    cdn = await serve((_request, response) => response.writeHead(200, { "access-control-allow-origin": "*" }).end("Loaded through a redirect"));
    allowed = await serve((request, response) => {
        const redirects: Record<string, string> = { "/redirect": `${base(forbidden)}/redirected`, "/leak-bounce": `${base(forbidden)}/bounced`, "/bounce": `${base(cdn)}/data` };
        const target = redirects[request.url ?? ""];
        if (target !== undefined) return void response.writeHead(302, { location: target }).end();
        response.writeHead(200, { "content-type": "text/html" }).end(page(SCRIPT(base(forbidden))));
    });
    port = await connectBrowser(BROWSER_URL);
});

afterAll(async () => {
    await port?.close();
    allowed?.close();
    forbidden?.close();
    cdn?.close();
});

async function onlyAllowed(url: string): Promise<void> {
    if (![allowed, cdn].some((server) => url.startsWith(`${base(server)}/`))) throw new FetchRefused(`refused: ${url}`);
}

test.skipIf(BROWSER_URL === undefined)("a real browser renders a script-built page and never reaches a disallowed address, directly or by a page or script redirect", async () => {
    const rendered = await renderPage(port, { url: `${base(allowed)}/`, check: onlyAllowed, seconds: 10, maxBytes: 100_000 });
    expect(rendered.html).toContain("Built by script");
    expect(rendered.html).toContain("Loaded through a redirect");
    await expect(renderPage(port, { url: `${base(allowed)}/redirect`, check: onlyAllowed, seconds: 10, maxBytes: 100_000 })).rejects.toBeInstanceOf(FetchRefused);
    expect(hits).toEqual([]);
});
