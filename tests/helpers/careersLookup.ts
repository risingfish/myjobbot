import type { AssistantMessage, ChatFn } from "../../src/agent/llm.js";
import { dataMarkers } from "../../src/agent/markers.js";
import type { BrowserPort } from "../../src/careers/browser.js";
import type { LookupDeps } from "../../src/careers/lookUpJob.js";
import { PageRenderer } from "../../src/careers/renderState.js";
import type { SearchResult } from "../../src/careers/searxng.js";
import type { SoughtJob } from "../../src/careers/session.js";
import type { TextGetter } from "../../src/http/client.js";
import { makeJob } from "../../src/jobs/job.js";
import { fakeBoardHttp } from "./boardData.js";
import { scriptedChat, toolCallReply } from "./chat.js";
import { testFileConfig } from "./config.js";
import { TEST_NOW, TEST_RUN_ID } from "./context.js";
import { publicDns } from "./fakeDns.js";
import { MemoryCareersStore } from "./memoryCareersStore.js";
import { memoryStores } from "./memoryStore.js";
import { memoryTrace } from "./trace.js";

export const JOB: SoughtJob = { ats: "linkedin", jobId: "li_1", title: "Senior Backend Engineer", company: "Acme", location: "Remote" };
export const CAREERS_URL = "https://acme.example/careers/";
export const POSTING_URL = "https://acme.example/careers/backend";

interface Setup {
    replies?: AssistantMessage[];
    chat?: ChatFn;
    pages?: Record<string, string>;
    results?: SearchResult[];
    boards?: Record<string, unknown>;
    connect?: () => Promise<BrowserPort>;
}

export function result(url: string, title = "Acme careers"): SearchResult {
    return { url, title, snippet: "" };
}

export const search = () => toolCallReply("search_careers", {});
export const open = (link: number, as: "careers_page" | "job_page") => toolCallReply("open_link", { link, as });
export const finish = (found: boolean, reason?: string) => toolCallReply("finish_lookup", reason === undefined ? { found } : { found, reason });

export function fakePages(pages: Record<string, string>): TextGetter & { fetched: string[] } {
    const fetched: string[] = [];
    return {
        fetched,
        getText: async (url) => {
            fetched.push(url);
            const html = pages[url];
            if (html === undefined) throw new Error(`GET ${url} failed with HTTP 404`);
            return { url, html, cut: false };
        },
    };
}

export async function lookupSetup(setup: Setup) {
    const stores = memoryStores();
    await stores.jobStore.upsertAll([makeJob({ ats: "linkedin", jobId: JOB.jobId, company: JOB.company, title: JOB.title, url: "https://www.linkedin.com/jobs/view/1/" }, {})], TEST_NOW.toISOString(), "Gmail alerts");
    const careers = new MemoryCareersStore();
    const scripted = scriptedChat(setup.replies ?? []);
    const searches: string[] = [];
    const trace = memoryTrace();
    const pages = { pages: fakePages(setup.pages ?? {}), lookup: publicDns(), maxBytes: 1_000_000 };
    const renderer = new PageRenderer({ connect: setup.connect ?? null, settings: testFileConfig().careers_lookup, lookup: pages.lookup, careers, trace, runId: "run-1", now: () => TEST_NOW });
    const deps: LookupDeps = { chat: setup.chat ?? scripted.chat, trace, settings: testFileConfig().careers_lookup, pages, jobs: stores.jobStore, careers, runId: "run-1", now: () => TEST_NOW, boards: { http: fakeBoardHttp(setup.boards ?? {}), cache: new Map() }, renderer, markers: dataMarkers(TEST_RUN_ID), search: async (company) => (searches.push(company), setup.results ?? []) };
    return { deps, stores, careers, searches, trace, requests: scripted.requests };
}
