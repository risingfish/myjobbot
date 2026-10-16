import { expect, test } from "vitest";
import { parseAlert } from "../src/gmail/alertJobs/parse.js";
import { alertEmail, digest, DIGEST_SENDER, fixtureJobs, notification, SEARCH_SENDER, searchAlert } from "./helpers/alertEmails.js";

const FIRST = { id: "4100000001", title: "Senior Software Engineer, Platform", company: "Acme & Sons", location: "Boise, ID" };
const SECOND = { id: "4100000002", title: "Staff Engineer", company: "Beta Co", location: "Remote" };
const JOBS = [FIRST, SECOND];

test("a saved-search alert gives its keywords and every job in order", () => {
    const parsed = parseAlert(alertEmail(1, SEARCH_SENDER, searchAlert(JOBS, "senior software engineer")));
    expect([parsed.layout, parsed.keywords]).toEqual(["linkedin_search", "senior software engineer"]);
    expect(parsed.jobs).toEqual([
        { linkedinId: "4100000001", title: "Senior Software Engineer, Platform", company: "Acme & Sons", location: "Boise, ID", salary: null },
        { linkedinId: "4100000002", title: "Staff Engineer", company: "Beta Co", location: "Remote", salary: null },
    ]);
    expect(parseAlert(alertEmail(2, SEARCH_SENDER, searchAlert(fixtureJobs(25), "x"))).jobs).toHaveLength(25);
});

test("a recommendation digest gives its jobs and no keywords", () => {
    const parsed = parseAlert(alertEmail(1, DIGEST_SENDER, digest(JOBS)));
    expect([parsed.layout, parsed.keywords, parsed.jobs.map((job) => job.linkedinId)]).toEqual(["linkedin_digest", null, ["4100000001", "4100000002"]]);
});

test("an extra line counts as salary only when it looks like money", () => {
    const jobs = [
        { ...FIRST, extra: "$120K/yr - $150K/yr" },
        { ...SECOND, extra: "Actively recruiting" },
    ];
    expect(parseAlert(alertEmail(1, SEARCH_SENDER, searchAlert(jobs, "x"))).jobs.map((job) => job.salary)).toEqual(["$120K/yr - $150K/yr", null]);
});

test("a job link without a numeric id is skipped and the rest still parse", () => {
    const html = searchAlert(JOBS, "x").replaceAll("jobs/view/4100000001", "jobs/view/oops");
    expect(parseAlert(alertEmail(1, SEARCH_SENDER, html)).jobs.map((job) => job.linkedinId)).toEqual(["4100000002"]);
});

test("mail without job links, or from a sender with no layout, gives no jobs", () => {
    expect(parseAlert(alertEmail(1, DIGEST_SENDER, notification()))).toEqual({ layout: null, keywords: null, jobs: [] });
    expect(parseAlert(alertEmail(2, "alert@indeed.com", searchAlert(JOBS, "x")))).toEqual({ layout: null, keywords: null, jobs: [] });
});

test("encoded characters in titles and companies are decoded", () => {
    const jobs = [{ id: "4100000009", title: "Engineer – Café O'Neil", company: "A=B Labs", location: "Zürich" }];
    const html = searchAlert(jobs, "x").replace("A=B", "A&#61;B").replace("é", "&#233;");
    expect(parseAlert(alertEmail(1, SEARCH_SENDER, html)).jobs[0]).toMatchObject({ title: "Engineer – Café O'Neil", company: "A=B Labs", location: "Zürich" });
});

test("an out-of-range character reference or a relative search link never stops parsing", () => {
    const html = searchAlert([{ ...FIRST, title: "Engineer &#9999999999; Lead" }], "x").replace(/href="https:\/\/www\.linkedin\.com\/comm\/jobs\/search-results\//, 'href="/comm/jobs/search-results/');
    const parsed = parseAlert(alertEmail(1, SEARCH_SENDER, html));
    expect([parsed.layout, parsed.keywords, parsed.jobs[0]?.title]).toEqual(["linkedin_digest", null, "Engineer &#9999999999; Lead"]);
});
