import { expect, test } from "vitest";
import { searchCareers, SearchUnavailable } from "../src/careers/searxng.js";
import { searxngJson } from "./helpers/careersPages.js";
import { fakeBoard } from "./helpers/http.js";

const REQUEST = { company: "Acme Corp", max: 10, maxChars: 12_000 };

test("searchCareers asks SearXNG for '<company> careers' as JSON, with or without a trailing slash", async () => {
    for (const base of ["https://search.example", "https://search.example/"]) {
        const http = fakeBoard(searxngJson([]));
        await searchCareers(http, { base, ...REQUEST });
        const url = new URL(http.urls[0] ?? "");
        expect(url.origin + url.pathname).toBe("https://search.example/search");
        expect(url.searchParams.get("q")).toBe("Acme Corp careers");
        expect(url.searchParams.get("format")).toBe("json");
    }
});

test("results are web addresses kept once each, shortened, within max and the character budget", async () => {
    const long = "x".repeat(300);
    const json = searxngJson([{ url: "https://acme.example/careers", title: long, content: long }, { url: "https://acme.example/careers", title: "Duplicate" }, { url: "ftp://acme.example/", title: "Not web" }, ...Array.from({ length: 12 }, (_, index) => ({ url: `https://jobs.example/${index}`, title: `Job ${index}` }))]);
    const results = await searchCareers(fakeBoard(json), { base: "https://search.example", ...REQUEST });
    expect(results[0]).toEqual({ url: "https://acme.example/careers", title: "x".repeat(120), snippet: "x".repeat(200) });
    expect(results).toHaveLength(10);
    expect(results.map((result) => result.url)).not.toContain("ftp://acme.example/");
    const tight = await searchCareers(fakeBoard(json), { base: "https://search.example", ...REQUEST, maxChars: 400 });
    expect(JSON.stringify(tight).length).toBeLessThanOrEqual(400);
});

test("SearXNG is unavailable for bad JSON or a failed request, but zero results are fine", async () => {
    const base = "https://search.example";
    await expect(searchCareers(fakeBoard({ unexpected: true }), { base, ...REQUEST })).rejects.toBeInstanceOf(SearchUnavailable);
    const failing = { getJson: () => Promise.reject(new Error("GET https://search.example/search failed with HTTP 403")) };
    await expect(searchCareers(failing, { base, ...REQUEST })).rejects.toThrow(/search\.formats/);
    expect(await searchCareers(fakeBoard(searxngJson([])), { base, ...REQUEST })).toEqual([]);
});
