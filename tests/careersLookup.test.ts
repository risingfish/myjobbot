import { expect, test } from "vitest";
import { lookUpJob } from "../src/careers/lookUpJob.js";
import { chatThenCrash } from "./helpers/chat.js";
import { jobPage, listingPage, scriptOnlyPage } from "./helpers/careersPages.js";
import { CAREERS_URL, finish, JOB, lookupSetup, open, POSTING_URL, result, search } from "./helpers/careersLookup.js";

const LISTING = listingPage([
    { title: "Data Analyst", href: "data-analyst" },
    { title: JOB.title, href: "backend" },
]);
const POSTING = jobPage(JOB.title, ["Build APIs in TypeScript.", "Remote in the US."]);

test("a job found through its careers page is stored with the job page's text and address", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: LISTING, [POSTING_URL]: POSTING }, replies: [search(), open(1, "careers_page"), open(2, "job_page"), finish(true)] });
    const outcome = await lookUpJob(setup.deps, JOB);
    expect(outcome).toMatchObject({ found: true, url: POSTING_URL, careersUrl: CAREERS_URL });
    expect(await setup.stores.jobStore.findJob(JOB.jobId)).toMatchObject({ description_source: "careers", description_url: POSTING_URL, description: expect.stringContaining("Build APIs in TypeScript.") });
    expect(setup.careers.rows).toEqual([expect.objectContaining({ step: "finish", outcome: "found", url: POSTING_URL, reason: null })]);
});

test("a job page offered straight in the search results can be used without a careers page", async () => {
    const setup = await lookupSetup({ results: [result(POSTING_URL, JOB.title)], pages: { [POSTING_URL]: POSTING }, replies: [search(), open(1, "job_page"), finish(true)] });
    expect(await lookUpJob(setup.deps, JOB)).toMatchObject({ found: true, url: POSTING_URL, careersUrl: null });
});

test("a job the model can't find is reported with its reason and no description is written", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: LISTING }, replies: [search(), open(1, "careers_page"), finish(false, "job_not_found")] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "job_not_found" });
    expect((await setup.stores.jobStore.findJob(JOB.jobId))?.description).toBeNull();
    expect(setup.careers.rows).toEqual([expect.objectContaining({ step: "finish", outcome: "failed", reason: "job_not_found", warning: true, url: CAREERS_URL })]);
});

test("a lookup that never finishes gives up at its step limit", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], replies: Array.from({ length: 10 }, search) });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "gave_up" });
    expect(setup.requests).toHaveLength(8);
});

test("a careers page with no job links that ends the lookup is reported as unreadable, naming the page", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: scriptOnlyPage() }, replies: [search(), open(1, "careers_page"), open(7, "job_page"), open(8, "job_page")] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "careers_page_unreadable" });
    expect(setup.careers.rows[0]).toMatchObject({ reason: "careers_page_unreadable", url: CAREERS_URL });
});

test("a model server failure ends the lookup as lookup_error, not gave_up", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], chat: chatThenCrash([search()], new Error("connect ECONNREFUSED")) });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "lookup_error" });
});
