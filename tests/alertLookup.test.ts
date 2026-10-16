import { expect, test } from "vitest";
import type { AlertJob, ParsedAlert } from "../src/gmail/alertJobs/parse.js";
import { matchResults, planQuery } from "../src/gmail/alertJobs/lookup.js";
import { makeJob } from "../src/jobs/job.js";

function alertJob(linkedinId: string, title: string, rest: { company: string; location?: string | null }): AlertJob {
    return { linkedinId, title, company: rest.company, location: rest.location === undefined ? "Boise, ID" : rest.location, salary: null };
}

function result(id: string, url: string, named: { company: string; title: string }) {
    return makeJob({ ats: "jsearch", jobId: id, company: named.company, title: named.title, url }, { description: `about ${id}` });
}

const SEARCH: ParsedAlert = { layout: "linkedin_search", keywords: "senior software engineer", jobs: [] };
const DIGEST: ParsedAlert = { layout: "linkedin_digest", keywords: null, jobs: [] };

test("a saved-search alert is looked up by its keywords and the location most of its jobs share", () => {
    const pending = [alertJob("1", "A", { company: "X" }), alertJob("2", "B", { company: "Y" }), alertJob("3", "C", { company: "Z", location: "Remote" })];
    expect(planQuery({ alert: SEARCH, pending })).toBe("senior software engineer in Boise, ID");
    expect(planQuery({ alert: SEARCH, pending: [alertJob("1", "A", { company: "X", location: "Remote" }), alertJob("2", "B", { company: "Y", location: "Denver, CO" }), alertJob("3", "C", { company: "Z" })] })).toBe("senior software engineer");
});

test("a digest is looked up by its most common title", () => {
    const pending = [alertJob("1", "Senior Engineer", { company: "X" }), alertJob("2", "senior engineer", { company: "Y" }), alertJob("3", "Data Analyst", { company: "Z" })];
    expect(planQuery({ alert: DIGEST, pending })).toBe("Senior Engineer in Boise, ID");
});

test("an email with nothing left to look up gets no search", () => {
    expect(planQuery({ alert: SEARCH, pending: [] })).toBeNull();
});

test("results match alert jobs by the LinkedIn id in their link first, with or without a slug", () => {
    const jobs = [alertJob("4100000001", "Platform Engineer", { company: "Acme" }), alertJob("4100000002", "Data Engineer", { company: "Beta" })];
    const results = [result("r1", "https://www.linkedin.com/jobs/view/4100000001/", { company: "Acme Inc", title: "Platform Eng" }), result("r2", "https://www.linkedin.com/jobs/view/data-engineer-at-beta-4100000002?x=1", { company: "Beta", title: "Data Engineer II" })];
    const matches = matchResults(jobs, results);
    expect([matches.get("4100000001")?.jobId, matches.get("4100000002")?.jobId]).toEqual(["r1", "r2"]);
});

test("otherwise results match by company and title, each result at most once", () => {
    const jobs = [alertJob("1", "Senior Backend Engineer", { company: "Acme" }), alertJob("2", "Senior Backend Engineer", { company: "Acme" }), alertJob("3", "Designer", { company: "Gamma" })];
    const matches = matchResults(jobs, [result("r1", "https://acme.example/jobs/1", { company: "ACME", title: "senior backend engineer" })]);
    expect([matches.get("1")?.jobId, matches.has("2"), matches.has("3")]).toEqual(["r1", false, false]);
});
