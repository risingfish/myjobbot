import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { workday } from "../src/sources/modules/workday.js";
import { workdayDetail, workdaySearch } from "./helpers/boardData.js";

const PARAMS = { host: "acme.wd5.myworkdayjobs.com", tenant: "acme", site: "Acme_Careers" };
const BASE = "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Acme_Careers";

function workdaySite(paths: string[], html = "<p>Build APIs &amp; services.</p>") {
    const posts: unknown[] = [];
    const listed = paths.map((path, index) => ({ title: `Engineer ${index}`, path, location: "Remote" }));
    const http = {
        postJson: async (url: string, body: unknown) => {
            posts.push({ url, body });
            const { offset, limit } = body as { offset: number; limit: number };
            return workdaySearch(listed.slice(offset, offset + limit));
        },
        getJson: async (url: string) => workdayDetail(`Engineer at ${url.slice(BASE.length)}`, html),
    };
    return { http, posts };
}

function numbered(count: number) {
    return Array.from({ length: count }, (_, index) => `/job/Remote/Engineer_R${index}`);
}

async function pages(site: ReturnType<typeof workdaySite>, from: Record<string, unknown> | null) {
    const read = [];
    for await (const page of workday.fetch(PARAMS, { http: site.http, sourceName: "Acme" }, from)) read.push(page);
    return read;
}

test("the Workday module recognises a jobs site's link, with or without a locale, and a posting on it", () => {
    const links = ["https://acme.wd5.myworkdayjobs.com/Acme_Careers", "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers", "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Remote/SBE_R1"];
    expect(links.map((link) => workday.fromUrl?.(new URL(link)))).toEqual([PARAMS, PARAMS, PARAMS]);
    expect(workday.fromUrl?.(new URL("https://jobs.lever.co/acme"))).toBeNull();
});

test("a Workday site is read 20 jobs a page, each page saying where the next starts, from a given place", async () => {
    const site = workdaySite(numbered(45));
    const read = await pages(site, { offset: 20 });
    expect(read.map((page) => [page.jobs.length, page.next, page.cost])).toEqual([
        [20, { offset: 40 }, 0],
        [5, null, 0],
    ]);
    expect(site.posts).toEqual([
        { url: `${BASE}/jobs`, body: { appliedFacets: {}, limit: 20, offset: 20, searchText: "" } },
        { url: `${BASE}/jobs`, body: { appliedFacets: {}, limit: 20, offset: 40, searchText: "" } },
    ]);
});

test("a short last page, and an empty page after exactly 20 jobs, both end the site", async () => {
    expect((await pages(workdaySite(numbered(7)), null)).map((page) => page.next)).toEqual([null]);
    expect((await pages(workdaySite(numbered(20)), null)).map((page) => [page.jobs.length, page.next])).toEqual([
        [20, { offset: 20 }],
        [0, null],
    ]);
});

test("each Workday job takes its posting's description as Markdown, and an id unique to its site", async () => {
    const long = `/job/Remote/${"x".repeat(260)}`;
    const [page] = await pages(workdaySite(["/job/Remote/SBE_R1", long]), null);
    expect(page?.jobs[0]).toMatchObject({ ats: "workday", jobId: "acme/Acme_Careers/SBE_R1", company: "Acme", title: "Engineer at /job/Remote/SBE_R1", location: "Remote", url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/Remote/SBE_R1", description: "Build APIs \\& services.", descriptionFormat: "markdown" });
    expect(page?.jobs[1]?.jobId).toBe(
        createHash("sha256")
            .update(`acme/Acme_Careers/${"x".repeat(260)}`)
            .digest("hex"),
    );
});
