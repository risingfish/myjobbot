import { expect, test } from "vitest";
import { lookUpJob } from "../src/careers/lookUpJob.js";
import { chatThenCrash } from "./helpers/chat.js";
import { jobPage, listingPage, scriptOnlyPage } from "./helpers/careersPages.js";
import { CAREERS_URL, finish, JOB, lookupSetup, open, POSTING_URL, result, search } from "./helpers/careersLookup.js";
import { TEST_NOW } from "./helpers/context.js";

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
    expect(setup.careers.rows.at(-1)).toMatchObject({ step: "finish", outcome: "found", url: POSTING_URL, reason: null });
    expect(await setup.careers.rememberedPage("acme")).toMatchObject({ company: "Acme", url: CAREERS_URL });
});

test("a job page offered straight in the search results can be used without a careers page", async () => {
    const setup = await lookupSetup({ results: [result(POSTING_URL, JOB.title)], pages: { [POSTING_URL]: POSTING }, replies: [search(), open(1, "job_page"), finish(true)] });
    expect(await lookUpJob(setup.deps, JOB)).toMatchObject({ found: true, url: POSTING_URL, careersUrl: null });
});

test("a job the model can't find is reported with its reason and no description is written", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: LISTING }, replies: [search(), open(1, "careers_page"), finish(false, "job_not_found")] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "job_not_found" });
    expect((await setup.stores.jobStore.findJob(JOB.jobId))?.description).toBeNull();
    expect(setup.careers.rows.at(-1)).toMatchObject({ step: "finish", outcome: "failed", reason: "job_not_found", warning: true, url: CAREERS_URL });
});

test("a lookup that never finishes gives up at its step limit", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], replies: Array.from({ length: 10 }, search) });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "gave_up" });
    expect(setup.requests).toHaveLength(8);
});

test("a careers page with no job links that ends the lookup is reported as unreadable, naming the page", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: scriptOnlyPage() }, replies: [search(), open(1, "careers_page"), open(7, "job_page"), open(8, "job_page")] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "careers_page_unreadable" });
    expect(setup.careers.rows.at(-1)).toMatchObject({ reason: "careers_page_unreadable", url: CAREERS_URL });
});

test("a model server failure ends the lookup as lookup_error, not gave_up", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], chat: chatThenCrash([search()], new Error("connect ECONNREFUSED")) });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "lookup_error" });
});

test("a found lookup leaves its whole trail in the audit log, in order", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: LISTING, [POSTING_URL]: POSTING }, replies: [search(), open(1, "careers_page"), open(2, "job_page"), finish(true)] });
    await lookUpJob(setup.deps, JOB);
    expect(setup.careers.rows.map((row) => [row.step, row.outcome, row.url])).toEqual([
        ["search", "ok", "Acme careers"],
        ["open_careers", "ok", CAREERS_URL],
        ["open_job", "ok", POSTING_URL],
        ["finish", "found", POSTING_URL],
    ]);
    expect(setup.careers.rows[1]).toMatchObject({ chars: expect.any(Number), cut: false, morePages: false, pageSource: "html", fallback: null, board: null });
    expect(setup.careers.rows[2]).toMatchObject({ pageSource: "html" });
    expect(JSON.stringify(setup.careers.rows)).not.toContain("Build APIs");
});

test("a lookup with no careers page in the results lists only the result addresses, capped", async () => {
    const results = Array.from({ length: 40 }, (_, index) => result(`https://board${index}.example/${"x".repeat(60)}`, `Board ${index} snippet text`));
    const setup = await lookupSetup({ results, replies: [search(), finish(false, "no_careers_page")] });
    await lookUpJob(setup.deps, JOB);
    const detail = setup.careers.rows.at(-1)?.detail ?? "";
    expect(detail.startsWith("https://board0.example/")).toBe(true);
    expect(detail.length).toBeLessThanOrEqual(2000);
    expect(detail).not.toContain("snippet");
});

test("a refused or timed-out fetch writes a failed step and names the reason when the lookup ends unfinished", async () => {
    const refused = await lookupSetup({ results: [result("http://acme.example:8080/careers")], replies: [search(), open(1, "careers_page"), open(1, "careers_page")] });
    expect(await lookUpJob(refused.deps, JOB)).toEqual({ found: false, reason: "fetch_refused" });
    expect(refused.careers.rows[1]).toMatchObject({ step: "open_careers", outcome: "failed", reason: "fetch_refused" });
    const slow = await lookupSetup({ results: [result(CAREERS_URL)], replies: [search(), open(1, "careers_page"), open(1, "careers_page")] });
    const timeout = new Error("GET failed", { cause: new DOMException("timed out", "TimeoutError") });
    const pages = { ...slow.deps.pages, pages: { getText: () => Promise.reject(timeout) } };
    expect(await lookUpJob({ ...slow.deps, pages }, JOB)).toEqual({ found: false, reason: "timed_out" });
});

async function rememberedSetup(replies: ReturnType<typeof search>[], page: string) {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: page, [POSTING_URL]: POSTING }, replies });
    await setup.careers.rememberPage({ companyKey: "acme", company: "Acme", url: CAREERS_URL }, "2026-09-01T00:00:00.000Z");
    return setup;
}

test("a remembered careers page is offered first, so no search is needed", async () => {
    const setup = await rememberedSetup([open(1, "careers_page"), open(2, "job_page"), finish(true)], LISTING);
    expect(await lookUpJob(setup.deps, JOB)).toMatchObject({ found: true });
    expect(String(setup.requests[0]?.[1]?.content)).toContain(`Remembered careers page: [1] ${CAREERS_URL}`);
    expect(setup.searches).toEqual([]);
    expect(setup.careers.rows[0]).toMatchObject({ step: "remembered", outcome: "ok", url: CAREERS_URL });
    expect(await setup.careers.rememberedPage("acme")).toMatchObject({ last_used_at: TEST_NOW.toISOString() });
});

test("a remembered careers page that fails to load is forgotten, and searching still works", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], replies: [open(1, "careers_page"), search(), finish(false, "no_careers_page")] });
    await setup.careers.rememberPage({ companyKey: "acme", company: "Acme", url: "https://acme.example/old-careers" }, "2026-09-01T00:00:00.000Z");
    await lookUpJob(setup.deps, JOB);
    expect(await setup.careers.rememberedPage("acme")).toBeNull();
    expect(setup.careers.rows[1]).toMatchObject({ step: "open_careers", outcome: "failed", detail: "forgotten" });
    expect(setup.searches).toEqual(["Acme"]);
});

test("a remembered careers page with no job links is forgotten too", async () => {
    const setup = await rememberedSetup([open(1, "careers_page"), finish(false, "careers_page_unreadable")], scriptOnlyPage());
    await lookUpJob(setup.deps, JOB);
    expect(await setup.careers.rememberedPage("acme")).toBeNull();
    expect(setup.careers.rows[1]).toMatchObject({ step: "open_careers", outcome: "failed", detail: "forgotten" });
});

test("a job page with no text is never stored as found, even when the model says found", async () => {
    const setup = await lookupSetup({ results: [result(POSTING_URL, JOB.title)], pages: { [POSTING_URL]: scriptOnlyPage() }, replies: [search(), open(1, "job_page"), finish(true), finish(true)] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "job_page_unreadable" });
    expect(await setup.stores.jobStore.findJob(JOB.jobId)).toMatchObject({ description: null, description_source: null });
});

test("a lookup that keeps opening pages ends after the fifth open as gave_up, not as a tool-error abort", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], pages: { [CAREERS_URL]: LISTING }, replies: [search(), ...Array.from({ length: 5 }, () => open(1, "careers_page")), search()] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "gave_up" });
    expect(setup.requests).toHaveLength(6);
    expect(setup.trace.events).toContainEqual(expect.objectContaining({ type: "end", status: "finished" }));
});

test("a lookup that stops on a job page with no text names job_page_unreadable, not gave_up", async () => {
    const setup = await lookupSetup({ results: [result(POSTING_URL, JOB.title)], pages: { [POSTING_URL]: scriptOnlyPage() }, replies: [search(), open(1, "job_page"), ...Array.from({ length: 6 }, search)] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "job_page_unreadable" });
});

test("an open past the limit after a refused fetch still reports fetch_refused", async () => {
    const setup = await lookupSetup({ results: [result("http://acme.example:8080/careers")], replies: [search(), ...Array.from({ length: 5 }, () => open(1, "careers_page"))] });
    expect(await lookUpJob(setup.deps, JOB)).toEqual({ found: false, reason: "fetch_refused" });
});

test("a retried job notes the retry first in its audit trail", async () => {
    const setup = await lookupSetup({ results: [result(CAREERS_URL)], replies: [search(), finish(false, "no_careers_page")] });
    await lookUpJob(setup.deps, { ...JOB, retry: true });
    expect(setup.careers.rows.map((row) => [row.step, row.outcome])).toEqual([["retry", "ok"], ["search", "ok"], ["finish", "failed"]]);
});
