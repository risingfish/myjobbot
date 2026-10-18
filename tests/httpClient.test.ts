import { expect, onTestFinished, test, vi } from "vitest";
import { HttpClient } from "../src/http/client.js";
import { fakeClock } from "./helpers/clock.js";
import { testFileConfig } from "./helpers/config.js";
import { jsonResponse, scriptedFetch } from "./helpers/http.js";

const URL_A = "https://a.example/board";

function client(responses: Response[]) {
    const clock = fakeClock();
    const { fetchFn, urls, inits } = scriptedFetch(responses);
    const http = new HttpClient({ config: testFileConfig().http, clock, fetchFn, random: () => 0 });
    return { http, clock, urls, inits };
}

function trackedClock(events: string[]) {
    const clock = fakeClock();
    const sleep = (ms: number) => {
        events.push("sleep");
        return clock.sleep(ms);
    };
    return { ...clock, sleep };
}

function spyOnTimeout(events: string[]) {
    const original = AbortSignal.timeout.bind(AbortSignal);
    return vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
        events.push("timeout");
        return original(ms);
    });
}

test("HttpClient returns parsed JSON", async () => {
    const { http } = client([jsonResponse({ jobs: [] })]);
    expect(await http.getJson(URL_A)).toEqual({ jobs: [] });
});

test("HttpClient retries a 503 with exponential backoff", async () => {
    const { http, clock, urls } = client([jsonResponse({}, 503), jsonResponse({ ok: true })]);
    expect(await http.getJson(URL_A)).toEqual({ ok: true });
    expect(urls).toHaveLength(2);
    expect(clock.sleeps).toEqual([1000]);
});

test("HttpClient honors Retry-After, capped at max_retry_after_s", async () => {
    const { http, clock } = client([jsonResponse({}, 429, { "retry-after": "7" }), jsonResponse({}, 429, { "retry-after": "999" }), jsonResponse({ ok: true })]);
    await http.getJson(URL_A);
    expect(clock.sleeps).toEqual([7000, 60_000]);
});

test("HttpClient gives up after max_retries", async () => {
    const { http, urls } = client([jsonResponse({}, 503), jsonResponse({}, 503), jsonResponse({}, 503)]);
    await expect(http.getJson(URL_A)).rejects.toThrow("HTTP 503");
    expect(urls).toHaveLength(3);
});

test("HttpClient does not retry a 404", async () => {
    const { http, urls } = client([jsonResponse({}, 404)]);
    await expect(http.getJson(URL_A)).rejects.toThrow("HTTP 404");
    expect(urls).toHaveLength(1);
});

test("HttpClient names the URL when fetch itself fails", async () => {
    const clock = fakeClock();
    const fetchFn = () => Promise.reject(new TypeError("fetch failed"));
    const http = new HttpClient({ config: testFileConfig().http, clock, fetchFn, random: () => 0 });
    await expect(http.getJson(URL_A)).rejects.toThrow(/https:\/\/a\.example\/board.*fetch failed/);
    const error = await http.getJson(URL_A).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ cause: expect.any(TypeError) });
});

test("HttpClient names the URL when the body is not JSON", async () => {
    const { http } = client([new Response("not json", { status: 200 })]);
    await expect(http.getJson(URL_A)).rejects.toThrow(URL_A);
});

test("HttpClient starts the timeout after the rate-limit wait", async () => {
    const events: string[] = [];
    const timeoutSpy = spyOnTimeout(events);
    onTestFinished(() => timeoutSpy.mockRestore());
    const config = { ...testFileConfig().http, min_interval_ms: 60_000, timeout_s: 1 };
    const { fetchFn } = scriptedFetch([jsonResponse({}), jsonResponse({})]);
    const http = new HttpClient({ config, clock: trackedClock(events), fetchFn, random: () => 0 });
    await http.getJson(URL_A);
    await http.getJson(URL_A);
    expect(events).toEqual(["timeout", "sleep", "timeout"]);
});

test("HttpClient sends request headers when given", async () => {
    const { http, inits } = client([jsonResponse({ ok: true })]);
    await http.getJson(URL_A, { "x-api-key": "secret" });
    expect(inits[0]?.headers).toEqual({ "x-api-key": "secret" });
});

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

test("getText returns an HTML page's body and sends the careers user agent", async () => {
    const { http, inits } = client([htmlResponse("<p>Jobs</p>")]);
    expect(await http.getText(URL_A, { maxBytes: 1000 })).toEqual({ url: URL_A, html: "<p>Jobs</p>", cut: false });
    expect(inits[0]).toMatchObject({ redirect: "manual", headers: { "user-agent": "myjobbot (+careers lookup)" } });
});

test("getText retries a 503 through the same path as getJson", async () => {
    const { http, clock, urls } = client([htmlResponse("", 503), htmlResponse("<p>ok</p>")]);
    expect(await http.getText(URL_A, { maxBytes: 1000 })).toMatchObject({ html: "<p>ok</p>" });
    expect(urls).toHaveLength(2);
    expect(clock.sleeps).toEqual([1000]);
});

test("getText refuses a response that isn't HTML", async () => {
    const { http } = client([jsonResponse({ jobs: [] })]);
    await expect(http.getText(URL_A, { maxBytes: 1000 })).rejects.toThrow("not an HTML page");
});

test("getText stops reading at maxBytes and reports the page as cut", async () => {
    const { http } = client([htmlResponse("x".repeat(5000))]);
    const page = await http.getText(URL_A, { maxBytes: 1024 });
    expect(page).toMatchObject({ cut: true });
    expect("html" in page ? page.html.length : 0).toBe(1024);
});

test("getText returns a redirect's target without following it", async () => {
    const { http, urls } = client([htmlResponse("", 302, { location: "/careers/" })]);
    expect(await http.getText(URL_A, { maxBytes: 1000 })).toEqual({ redirect: "https://a.example/careers/" });
    expect(urls).toHaveLength(1);
});

test("the redirect-refusing client posts a JSON body, retries a 503 like getJson, and names the method when it fails", async () => {
    const { http, inits, urls } = client([jsonResponse({}, 503), jsonResponse({ total: 1 }), jsonResponse({}, 404)]);
    expect(await http.withoutRedirects().postJson(URL_A, { searchText: "Engineer" })).toEqual({ total: 1 });
    expect(urls).toEqual([URL_A, URL_A]);
    expect(inits[1]).toMatchObject({ method: "POST", redirect: "manual", body: JSON.stringify({ searchText: "Engineer" }), headers: { "content-type": "application/json", accept: "application/json" } });
    await expect(http.withoutRedirects().postJson(URL_A, {})).rejects.toThrow(`POST ${URL_A} failed with HTTP 404`);
});

test("the redirect-refusing client fails on a redirect instead of following it, for GET and POST alike", async () => {
    const redirect = () => jsonResponse({}, 302, { location: "http://169.254.169.254/latest/meta-data/" });
    const { http, urls, inits } = client([redirect(), redirect()]);
    await expect(http.withoutRedirects().getJson(URL_A)).rejects.toThrow(`GET ${URL_A} was redirected`);
    await expect(http.withoutRedirects().postJson(URL_A, {})).rejects.toThrow(`POST ${URL_A} was redirected`);
    expect(urls).toEqual([URL_A, URL_A]);
    expect(inits.map((init) => init.redirect)).toEqual(["manual", "manual"]);
});
