import { expect, test } from "vitest";
import { HttpClient } from "../src/http/client.js";
import { parseBoardLink } from "../src/sources/boardLink.js";
import { jsearch } from "../src/sources/modules/jsearch.js";
import { readAll } from "./helpers/readAll.js";
import { moduleFor } from "../src/sources/registry.js";
import { sourceHttp } from "../src/sources/sourceHttp.js";
import { fakeClock } from "./helpers/clock.js";
import { testAppSettings } from "./helpers/config.js";
import { fakeDns, publicDns } from "./helpers/fakeDns.js";
import { fakeBoard, jsonResponse, scriptedFetch } from "./helpers/http.js";

const BOARDS = ["greenhouse", "lever", "ashby"] as const;

function board(id: string) {
    const found = moduleFor(id);
    if (found === null) throw new Error(`no module ${id}`);
    return found;
}

function linked(id: string, address: string) {
    return board(id).fromUrl?.(new URL(address)) ?? null;
}

test("the registry has the Greenhouse, Lever and Ashby modules, each a company board under its own id", () => {
    expect(BOARDS.map((id) => [board(id).id, board(id).kind, board(id).scope])).toEqual(BOARDS.map((id) => [id, "ats", "company"]));
});

test("a module is found by its id, and an unknown id finds none", () => {
    expect([moduleFor("lever")?.name, moduleFor("taleo")]).toEqual(["Lever", null]);
});

test("each board module takes a board id and refuses an empty one", () => {
    for (const id of BOARDS) {
        expect([board(id).params.safeParse({ slug: "stripe" }).success, board(id).params.safeParse({ slug: "" }).success]).toEqual([true, false]);
    }
});

test("the Greenhouse module recognises both of Greenhouse's board addresses, and a posting on one", () => {
    expect([linked("greenhouse", "https://boards.greenhouse.io/stripe"), linked("greenhouse", "https://job-boards.greenhouse.io/stripe"), linked("greenhouse", "https://boards.greenhouse.io/stripe/jobs/8172503")]).toEqual([{ slug: "stripe" }, { slug: "stripe" }, { slug: "stripe" }]);
});

test("the Lever and Ashby modules recognise their own board and posting links, and not each other's", () => {
    expect([linked("lever", "https://jobs.lever.co/palantir"), linked("lever", "https://jobs.lever.co/palantir/10dfc8bc"), linked("ashby", "https://jobs.ashbyhq.com/openai/240d459b")]).toEqual([{ slug: "palantir" }, { slug: "palantir" }, { slug: "openai" }]);
    expect([linked("lever", "https://jobs.ashbyhq.com/openai"), linked("ashby", "https://jobs.lever.co/palantir")]).toEqual([null, null]);
});

test("a board's target ignores letter case, and its suggested name is its board id capitalised, while a search's is its query", () => {
    expect([board("greenhouse").target({ slug: "Stripe" }), board("greenhouse").target({ slug: "stripe" }), board("greenhouse").suggestName?.({ slug: "stripe" })]).toEqual(["greenhouse:stripe", "greenhouse:stripe", "Stripe"]);
    const search = { query: "Backend Engineer", country: "us", remote_only: true };
    expect([jsearch.target(search), jsearch.suggestName?.(search)]).toEqual(["jsearch:backend engineer|us|true", "Backend Engineer"]);
});

test("a board module fetches the whole board as one page, with nothing to continue from and no cost", async () => {
    const pages = [];
    for await (const page of board("greenhouse").fetch({ slug: "stripe" }, { http: fakeBoard({ jobs: [] }), sourceName: "Stripe" }, null)) pages.push(page);
    expect(pages).toEqual([{ jobs: [], cost: 0, next: null }]);
});

function redirectingClient() {
    const { fetchFn, urls } = scriptedFetch([jsonResponse({}, 302, { location: "http://169.254.169.254/latest/meta-data/" })]);
    return { urls, http: new HttpClient({ config: testAppSettings().http, clock: fakeClock(), fetchFn, random: () => 0 }).withoutRedirects() };
}

test("a module's request goes through the checked client, which refuses a non-public address and follows no redirect", async () => {
    const http = sourceHttp({ http: fakeBoard({ jobs: [] }), lookup: fakeDns({ "boards-api.greenhouse.io": ["10.0.0.5"] }) });
    await expect(readAll(board("greenhouse"), { slug: "stripe" }, { http, sourceName: "Stripe" })).rejects.toThrow(/refused/);
    const open = sourceHttp({ http: fakeBoard({ jobs: [] }), lookup: fakeDns({ "boards-api.greenhouse.io": ["93.184.216.34"] }) });
    expect(await readAll(board("greenhouse"), { slug: "stripe" }, { http: open, sourceName: "Stripe" })).toEqual([]);
    const redirecting = redirectingClient();
    await expect(readAll(board("greenhouse"), { slug: "stripe" }, { http: sourceHttp({ http: redirecting.http, lookup: publicDns() }), sourceName: "Stripe" })).rejects.toThrow(/was redirected/);
    expect(redirecting.urls).toHaveLength(1);
});

test("a Greenhouse company's careers page is its public job board", () => {
    expect(board("greenhouse").company?.({ slug: "stripe" }, "Stripe")).toEqual({ name: "Stripe", careersPage: "https://job-boards.greenhouse.io/stripe" });
});

test("a Lever company's careers page is its public job board", () => {
    expect(board("lever").company?.({ slug: "leverdemo" }, "Lever Demo").careersPage).toBe("https://jobs.lever.co/leverdemo");
});

test("an Ashby company's careers page is its public job board", () => {
    expect(board("ashby").company?.({ slug: "ashby" }, "Ashby").careersPage).toBe("https://jobs.ashbyhq.com/ashby");
});

test("every board's careers page is one the board-link reader recognises, with the same board id", () => {
    const slugs = BOARDS.map((id) => parseBoardLink(board(id).company?.({ slug: "acme" }, "Acme").careersPage ?? "")?.slug);
    expect(slugs).toEqual(["acme", "acme", "acme"]);
});
