import { expect, test } from "vitest";
import type { ChatFn } from "../src/agent/llm.js";
import { lookUpCareers, type CareersDeps } from "../src/careers/lookUpJobs.js";
import { SEARCH_FAILED } from "../src/careers/searxng.js";
import type { SoughtJob } from "../src/careers/session.js";
import type { AuditEntry } from "../src/db/store.js";
import { jobPage, scriptOnlyPage, searxngJson } from "./helpers/careersPages.js";
import { finish, JOB, lookupSetup, open, POSTING_URL, search } from "./helpers/careersLookup.js";
import { scriptedChat } from "./helpers/chat.js";
import { testFileConfig } from "./helpers/config.js";
import { TEST_NOW } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";

class FailsFor extends MemoryCareersStore {
    constructor(private readonly jobId: string) {
        super();
    }

    override async audit(entry: AuditEntry): Promise<void> {
        if (entry.jobId === this.jobId) throw new Error("database gone");
        await super.audit(entry);
    }
}

const BETA: SoughtJob = { ...JOB, jobId: "li_2", company: "Beta" };
const GAMMA: SoughtJob = { ...JOB, jobId: "li_3", company: "Gamma" };
const NOT_FOUND = [search(), finish(false, "job_not_found")];
const BLANK = "https://acme.example/careers/blank";

async function careersSetup(options: { replies: ReturnType<typeof search>[]; settings?: object; chat?: ChatFn; http?: ReturnType<typeof fakeBoard>; pages?: Record<string, string> }) {
    const setup = await lookupSetup({ replies: options.replies, chat: options.chat, pages: options.pages ?? { [POSTING_URL]: jobPage(JOB.title, ["Build APIs."]) } });
    const http = options.http ?? fakeBoard(searxngJson([{ url: POSTING_URL, title: JOB.title }]));
    const settings = testFileConfig({ careers_lookup: options.settings ?? {} }).careers_lookup;
    const deps: CareersDeps = { ...setup.deps, settings, http, boardHttp: setup.deps.boards.http, searxngUrl: "https://search.example" };
    return { ...setup, deps, http };
}

test("jobs are looked up in order and the summary counts what was found and why the rest failed", async () => {
    const { deps, trace } = await careersSetup({ replies: [search(), open(1, "job_page"), finish(true), ...NOT_FOUND] });
    const summary = await lookUpCareers(deps, [JOB, BETA]);
    expect(summary).toEqual({ looked_up: 2, found: 1, failed: { job_not_found: 1 }, skipped_for_limit: 0 });
    expect(trace.events.at(-1)).toEqual({ type: "careers", ...summary });
});

test("lookups stop at max_per_run and the rest are counted as skipped", async () => {
    const { deps } = await careersSetup({ replies: NOT_FOUND, settings: { max_per_run: 1 } });
    expect(await lookUpCareers(deps, [JOB, BETA, GAMMA])).toMatchObject({ looked_up: 1, skipped_for_limit: 2 });
});

test("no new lookup starts once max_total_minutes has passed", async () => {
    let now = TEST_NOW.getTime();
    const scripted = scriptedChat([...NOT_FOUND, ...NOT_FOUND]);
    const chat: ChatFn = (messages, tools) => ((now += 40_000), scripted.chat(messages, tools));
    const { deps } = await careersSetup({ replies: [], chat, settings: { max_total_minutes: 2 } });
    expect(await lookUpCareers({ ...deps, now: () => new Date(now) }, [JOB, BETA, GAMMA])).toMatchObject({ looked_up: 2, skipped_for_limit: 1 });
});

test("two jobs at the same company in one run share one SearXNG request", async () => {
    const { deps, http } = await careersSetup({ replies: [...NOT_FOUND, ...NOT_FOUND] });
    await lookUpCareers(deps, [JOB, { ...JOB, jobId: "li_9" }]);
    expect(http.urls).toHaveLength(1);
});

test("with no SearXNG address the lookup is off and says why", async () => {
    const { deps, trace, requests } = await careersSetup({ replies: [] });
    const summary = await lookUpCareers({ ...deps, searxngUrl: null }, [JOB]);
    expect(summary).toEqual({ looked_up: 0, found: 0, failed: {}, skipped_for_limit: 0, note: "careers search not configured" });
    expect(trace.events).toEqual([{ type: "careers", ...summary }]);
    expect(requests).toEqual([]);
});

test("when SearXNG can't be used, no further lookups start and the note names the json setting", async () => {
    const failing = { getJson: () => Promise.reject(new Error("GET https://search.example/search failed with HTTP 403")), urls: [] };
    const { deps, requests } = await careersSetup({ replies: [search(), search()], http: failing });
    const summary = await lookUpCareers(deps, [JOB, BETA]);
    expect(summary).toMatchObject({ looked_up: 0, note: expect.stringContaining("search.formats includes json") });
    expect(requests).toHaveLength(1);
});

test("a lookup that throws counts as lookup_error and the next job is still looked up", async () => {
    const { deps, trace } = await careersSetup({ replies: [...NOT_FOUND, ...NOT_FOUND] });
    const summary = await lookUpCareers({ ...deps, careers: new FailsFor(JOB.jobId) }, [JOB, BETA]);
    expect(summary).toMatchObject({ looked_up: 2, failed: { lookup_error: 1, job_not_found: 1 } });
    expect(trace.events).toContainEqual(expect.objectContaining({ type: "careers_error", lookup: "linkedin:li_1" }));
});

test("search being off writes one skipped row that belongs to no job", async () => {
    const { deps, careers } = await careersSetup({ replies: [] });
    await lookUpCareers({ ...deps, searxngUrl: null }, [JOB, BETA]);
    expect(careers.rows).toEqual([expect.objectContaining({ step: "skipped", reason: "search_unavailable", ats: "", jobId: "", company: "" })]);
});

test("SearXNG failing writes one skipped row however many jobs waited, and the interrupted job has no finish row", async () => {
    const failing = { getJson: () => Promise.reject(new Error("GET https://search.example/search failed with HTTP 403")), urls: [] };
    const { deps, careers } = await careersSetup({ replies: [search(), search()], http: failing });
    await lookUpCareers(deps, [JOB, BETA, GAMMA]);
    expect(careers.rows).toEqual([expect.objectContaining({ step: "skipped", reason: "search_unavailable", detail: expect.stringContaining("search.formats") })]);
    expect(await careers.attempted([{ ats: JOB.ats, jobId: JOB.jobId }])).toEqual([]);
});

test("the summary says when rendering was needed but off, joined to any other note, and says nothing when it was never needed", async () => {
    const quiet = await careersSetup({ replies: NOT_FOUND });
    expect(await lookUpCareers(quiet.deps, [JOB])).not.toHaveProperty("note");
    const blank = await careersSetup({ replies: [search(), open(1, "job_page"), search(), search(), search(), search(), search(), search()], http: fakeBoard(searxngJson([{ url: BLANK, title: JOB.title }])), pages: { [BLANK]: scriptOnlyPage() } });
    expect(await lookUpCareers(blank.deps, [JOB])).toMatchObject({ note: "page rendering not configured" });
    const both = await careersSetup({ replies: [search()], http: { getJson: () => Promise.reject(new Error("HTTP 403")), urls: [] } });
    await both.deps.renderer.render(BLANK);
    expect((await lookUpCareers(both.deps, [JOB])).note).toBe(`${SEARCH_FAILED}; page rendering not configured`);
});
