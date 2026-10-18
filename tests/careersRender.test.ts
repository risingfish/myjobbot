import { expect, test } from "vitest";
import { FetchRefused } from "../src/careers/fetchPage.js";
import { renderPage } from "../src/careers/render.js";
import { fakeBrowser } from "./helpers/fakeBrowser.js";

const PAGE = "https://acme.example/careers";
const PRIVATE = new Set(["http://192.168.1.1/admin", "https://acme.example:8080/x", "https://user:pw@acme.example/x", "file:///etc/passwd", "ws://10.0.0.5/socket"]);

async function check(url: string): Promise<void> {
    if (PRIVATE.has(url)) throw new FetchRefused("refused: the address is not on the public internet");
}

function render(browser: ReturnType<typeof fakeBrowser>, maxBytes = 100_000) {
    return renderPage(browser.port, { url: PAGE, check, seconds: 15, maxBytes });
}

test("images, fonts, media and every refused address are aborted, and public scripts, documents and data requests go through", async () => {
    const requests = [
        { url: "https://cdn.example/logo.png", kind: "image", mainNavigation: false },
        { url: "https://cdn.example/font.woff2", kind: "font", mainNavigation: false },
        { url: "https://cdn.example/clip.mp4", kind: "media", mainNavigation: false },
        ...[...PRIVATE].filter((url) => !url.startsWith("ws:")).map((url) => ({ url, kind: "fetch", mainNavigation: false })),
        ...["script", "document", "xhr", "fetch"].map((kind) => ({ url: `https://cdn.example/${kind}`, kind, mainNavigation: false })),
    ];
    const browser = fakeBrowser({ requests, sockets: ["ws://10.0.0.5/socket", "wss://live.example/socket"] });
    await render(browser);
    expect(browser.verdicts.filter(([, allowed]) => allowed).map(([url]) => url)).toEqual(["https://cdn.example/script", "https://cdn.example/document", "https://cdn.example/xhr", "https://cdn.example/fetch", "wss://live.example/socket"]);
});

test("each rendering opens a fresh session that blocks service workers and downloads, routes before navigating, waits, and closes", async () => {
    const browser = fakeBrowser();
    expect(await render(browser)).toEqual({ url: PAGE, html: "<html><body><p>Rendered</p></body></html>", cut: false });
    expect(browser.sessions).toEqual([{ serviceWorkers: "block", acceptDownloads: false }]);
    expect(browser.calls).toEqual(["route", "routeWebSockets", `goto ${PAGE}`, "settle", "close session"]);
});

test("the rendered page is capped at the download limit", async () => {
    expect(await render(fakeBrowser({ html: "x".repeat(500) }), 100)).toMatchObject({ html: "x".repeat(100), cut: true });
});

test("a main navigation the check refused, or a page that ends on a refused address, is a refused fetch", async () => {
    const refusedMain = fakeBrowser({ requests: [{ url: "http://192.168.1.1/admin", kind: "document", mainNavigation: true }], gotoError: new Error("net::ERR_BLOCKED_BY_CLIENT") });
    await expect(render(refusedMain)).rejects.toBeInstanceOf(FetchRefused);
    await expect(render(fakeBrowser({ finalUrl: "http://192.168.1.1/admin" }))).rejects.toBeInstanceOf(FetchRefused);
    expect(refusedMain.calls.at(-1)).toBe("close session");
});

test("a page that never finishes loading still gives the content so far, and other failures are rethrown", async () => {
    const timeout = Object.assign(new Error("Timeout 15000ms exceeded"), { name: "TimeoutError" });
    expect(await render(fakeBrowser({ gotoError: timeout }))).toMatchObject({ html: expect.stringContaining("Rendered") });
    await expect(render(fakeBrowser({ gotoError: new Error("browser crashed") }))).rejects.toThrow("browser crashed");
});
