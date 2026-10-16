import { expect, test } from "vitest";
import { fetchPublicPage, FetchRefused, FetchTimedOut } from "../src/careers/fetchPage.js";
import type { TextGetter, TextResult } from "../src/http/client.js";
import { fakeDns } from "./helpers/fakeDns.js";

const DNS = fakeDns({ "acme.example": ["93.184.216.34"], "intranet.example": ["192.168.3.10"], "mixed.example": ["93.184.216.34", "10.0.0.5"] });

function pages(results: Record<string, TextResult | Error>): TextGetter & { fetched: string[] } {
    const fetched: string[] = [];
    return {
        fetched,
        getText: async (url) => {
            fetched.push(url);
            const result = results[url];
            if (result === undefined) throw new Error(`no fake page for ${url}`);
            if (result instanceof Error) throw result;
            return result;
        },
    };
}

function page(url: string): TextResult {
    return { url, html: "<p>ok</p>", cut: false };
}

test("a host resolving to a private address, even one of several, is refused and nothing is fetched", async () => {
    const getter = pages({});
    for (const url of ["https://intranet.example/jobs", "https://mixed.example/jobs", "http://127.0.0.1/"]) await expect(fetchPublicPage({ pages: getter, lookup: DNS, maxBytes: 1000 }, url)).rejects.toBeInstanceOf(FetchRefused);
    expect(getter.fetched).toEqual([]);
});

test("a redirect to a private host is refused, while a public one is followed", async () => {
    const getter = pages({ "https://acme.example/a": { redirect: "https://acme.example/b" }, "https://acme.example/b": page("https://acme.example/b"), "https://acme.example/c": { redirect: "https://intranet.example/x" } });
    const deps = { pages: getter, lookup: DNS, maxBytes: 1000 };
    expect(await fetchPublicPage(deps, "https://acme.example/a")).toMatchObject({ url: "https://acme.example/b" });
    await expect(fetchPublicPage(deps, "https://acme.example/c")).rejects.toBeInstanceOf(FetchRefused);
    expect(getter.fetched).not.toContain("https://intranet.example/x");
});

test("a sixth redirect is refused", async () => {
    const hops = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`https://acme.example/${index}`, { redirect: `https://acme.example/${index + 1}` }]));
    const getter = pages(hops);
    await expect(fetchPublicPage({ pages: getter, lookup: DNS, maxBytes: 1000 }, "https://acme.example/0")).rejects.toThrow(/redirects/);
    expect(getter.fetched).toHaveLength(6);
});

test("a fetch that times out becomes FetchTimedOut", async () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const getter = pages({ "https://acme.example/slow": new Error("GET https://acme.example/slow failed: aborted", { cause: timeout }) });
    await expect(fetchPublicPage({ pages: getter, lookup: DNS, maxBytes: 1000 }, "https://acme.example/slow")).rejects.toBeInstanceOf(FetchTimedOut);
});
