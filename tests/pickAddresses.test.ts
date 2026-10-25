import { expect, test } from "vitest";
import { mainName, storableUrl } from "../src/companies/hosts.js";
import { pickCareers, pickWebsite } from "../src/companies/pickAddresses.js";

const SKIP = ["linkedin.com", "indeed.com"];

function results(...urls: Array<string | [string, string]>) {
    return urls.map((entry) => (typeof entry === "string" ? { url: entry, title: "", snippet: "" } : { url: entry[0], title: entry[1], snippet: "" }));
}

function careers(found: ReturnType<typeof results>, website: string | null, rejected: string[] = []) {
    return pickCareers(found, { website, key: "acme", skipHosts: SKIP, rejected });
}

test("a host's main name drops www and the top-level domain", () => {
    expect(mainName("www.acme.com")).toBe("acme");
});

test("a host's main name drops a two-part country suffix", () => {
    expect(mainName("www.acme.co.uk")).toBe("acme");
});

test("a host's main name is the label before the suffix, not a subdomain", () => {
    expect(mainName("jobs.acmecorp.io")).toBe("acmecorp");
});

test("a country domain's main name is its first label", () => {
    expect(mainName("acme.de")).toBe("acme");
});

test("a single-label host has no main name", () => {
    expect(mainName("localhost")).toBeNull();
});

test("an https address can be stored", () => {
    expect(storableUrl("https://acme.com/careers")).toBe(true);
});

test("an address that isn't http(s) can't be stored", () => {
    expect(storableUrl("ftp://acme.com/")).toBe(false);
});

test("an address on an IP address or a single-label host can't be stored", () => {
    expect([storableUrl("http://10.0.0.5/jobs"), storableUrl("http://[::1]/"), storableUrl("http://intranet/careers")]).toEqual([false, false, false]);
});

test("an address with credentials or a port can't be stored", () => {
    expect([storableUrl("https://user:pw@acme.com/"), storableUrl("https://acme.com:8443/"), storableUrl(`https://acme.com/${"x".repeat(2001)}`)]).toEqual([false, false, false]);
});

test("the website is the first result whose main name contains the company, kept as its origin", () => {
    expect(pickWebsite(results("https://acmereviews.example.org/", "https://www.acme.com/about"), "acme", SKIP)).toEqual({ url: "https://www.acme.com", reason: null, rejected: [] });
});

test("a company name with spaces matches a host written without them", () => {
    expect(pickWebsite(results("https://acmewidgets.com/"), "acme widgets", SKIP).url).toBe("https://acmewidgets.com");
});

test("a job aggregator is never the website", () => {
    expect(pickWebsite(results("https://www.linkedin.com/company/acme", "https://acme.io/"), "acme", SKIP).url).toBe("https://acme.io");
});

test("an address that can't be stored is never the website", () => {
    expect(pickWebsite(results("https://acme.com:8443/", "https://acme.net/"), "acme", SKIP).url).toBe("https://acme.net");
});

test("no results means no website, for want of results", () => {
    expect(pickWebsite([], "acme", SKIP)).toEqual({ url: null, reason: "no_results", rejected: [] });
});

test("results that don't match leave no website and keep up to five of them as turned down", () => {
    const found = results(...Array.from({ length: 7 }, (_, index) => `https://other${index}.example/`));
    expect(pickWebsite(found, "acme", SKIP)).toEqual({ url: null, reason: "no_match", rejected: found.slice(0, 5).map((result) => result.url) });
});

test("the careers page is on the website's host, never one already turned down", () => {
    expect(careers(results("https://acme.com/careers/old", "https://acme.com/careers"), "https://acme.com", ["https://acme.com/careers/old"])).toEqual({ url: "https://acme.com/careers", reason: null, rejected: [] });
});

test("a careers subdomain counts for a website kept with www", () => {
    expect(careers(results("https://careers.acme.com/"), "https://www.acme.com").url).toBe("https://careers.acme.com/");
});

test("a careers page can be on another subdomain of the website", () => {
    expect(careers(results("https://boards.acme.com/careers"), "https://acme.com").url).toBe("https://boards.acme.com/careers");
});

test("a page on the website counts when its title says jobs", () => {
    expect(careers(results(["https://acme.com/open-roles", "Jobs at Acme"]), "https://acme.com").url).toBe("https://acme.com/open-roles");
});

test("a job board page for the company is its careers page", () => {
    expect(careers(results("https://jobs.lever.co/acme"), "https://acme.com").url).toBe("https://jobs.lever.co/acme");
});

test("a job board page for another company is turned down", () => {
    expect(careers(results("https://jobs.lever.co/acmeco-rival"), "https://acme.com")).toEqual({ url: null, reason: "no_match", rejected: ["https://jobs.lever.co/acmeco-rival"] });
});

test("a careers-looking page elsewhere or on an aggregator is turned down, after the pages already turned down", () => {
    const found = results("https://acme-reviews.example/acme-careers", "https://www.indeed.com/cmp/acme/jobs");
    expect(careers(found, "https://acme.com", ["https://acme.com/dead"])).toEqual({ url: null, reason: "no_match", rejected: ["https://acme.com/dead", "https://acme-reviews.example/acme-careers", "https://www.indeed.com/cmp/acme/jobs"] });
});

test("a job board page is found even when the company has no website", () => {
    expect(careers(results("https://acme.com/careers", "https://jobs.ashbyhq.com/acme"), null).url).toBe("https://jobs.ashbyhq.com/acme");
});

test("a short name matches only a site named exactly that, and a longer one also a site starting with it", () => {
    expect(pickWebsite(results("https://www.dropbox.com/", "https://box.com/"), "box", SKIP).url).toBe("https://box.com");
    expect(pickWebsite(results("https://notacme.com/", "https://acmecorp.io/"), "acme", SKIP)).toEqual({ url: "https://acmecorp.io", reason: null, rejected: [] });
});

test("a company whose name has no letters or digits gets no website or board page", () => {
    expect(pickWebsite(results("https://anything.com/"), "", SKIP)).toEqual({ url: null, reason: "no_match", rejected: [] });
    expect(pickCareers(results("https://jobs.lever.co/x"), { website: null, key: "", skipHosts: SKIP, rejected: [] }).url).toBeNull();
});

test("without a known website, pages turned down aren't remembered, so they can still be found once the website is", () => {
    expect(careers(results("https://acme.com/careers"), null, ["https://acme.com/dead"])).toEqual({ url: null, reason: "no_match", rejected: ["https://acme.com/dead"] });
});
