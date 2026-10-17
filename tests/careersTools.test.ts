import { expect, test } from "vitest";
import { FetchRefused } from "../src/careers/fetchPage.js";
import { newSession, type LookupSession } from "../src/careers/session.js";
import { lookupTools, type ToolPorts } from "../src/careers/tools.js";
import { trimPage, type TrimmedPage } from "../src/careers/trim.js";
import { jobPage, listingPage, scriptOnlyPage } from "./helpers/careersPages.js";
import { CAREERS_URL, JOB, result } from "./helpers/careersLookup.js";

function page(html: string, maxChars = 12_000): TrimmedPage {
    return trimPage(html, { baseUrl: CAREERS_URL, maxChars, sought: JOB.title });
}

function tools(ports: Partial<ToolPorts> = {}, session: LookupSession = newSession(JOB)) {
    const all: ToolPorts = { search: async () => [result(CAREERS_URL), result("https://jobs.example/acme")], open: async () => page(listingPage([{ title: JOB.title, href: "backend" }])), audit: async () => {}, forget: async () => {}, ...ports };
    const byName = Object.fromEntries(lookupTools(session, all).map((tool) => [tool.name, tool]));
    const call = (name: string, args: unknown = {}) => {
        const tool = byName[name];
        if (tool === undefined) throw new Error(`no tool ${name}`);
        return tool.invoke(args);
    };
    return { session, call };
}

test("search_careers numbers the results from 1 and registers them", async () => {
    const { session, call } = tools();
    expect(await call("search_careers")).toEqual({
        results: [
            { n: 1, url: CAREERS_URL, title: "Acme careers", snippet: "" },
            { n: 2, url: "https://jobs.example/acme", title: "Acme careers", snippet: "" },
        ],
    });
    expect(session.registry.get(2)).toBe("https://jobs.example/acme");
});

test("open_link refuses an unknown number", async () => {
    const { call } = tools();
    await expect(call("open_link", { link: 1, as: "careers_page" })).rejects.toThrow("call search_careers first");
    await call("search_careers");
    await expect(call("open_link", { link: 9, as: "careers_page" })).rejects.toThrow("valid links are 1-2");
});

test("four opens work and the fifth ends the lookup instead of failing, whatever link it names", async () => {
    const { session, call } = tools();
    await call("search_careers");
    for (let open = 0; open < 4; open += 1) await call("open_link", { link: 1, as: "careers_page" });
    expect(session.overLimit).toBe(false);
    expect(await call("open_link", { link: 9, as: "careers_page" })).toEqual({ note: "all 4 page opens are used; the lookup has ended" });
    expect(session.overLimit).toBe(true);
});

function blankJobPage(): TrimmedPage {
    return { url: "https://acme.example/careers/backend", text: "  \n ", links: [], cut: false, morePages: false, chars: 4 };
}

test("finish_lookup with found refuses a job page with no text and names job_page_unreadable", async () => {
    const { session, call } = tools({ open: async () => blankJobPage() });
    await call("search_careers");
    expect(await call("open_link", { link: 2, as: "job_page" })).toMatchObject({ note: expect.stringContaining("job_page_unreadable") });
    await expect(call("finish_lookup", { found: true })).rejects.toThrow("job_page_unreadable");
    expect(session.finished).toBeNull();
});

test("the last job page opened is the one finish_lookup judges", async () => {
    const pages = [page(jobPage(JOB.title, ["Build APIs."])), blankJobPage(), page(jobPage(JOB.title, ["Ship it."]))];
    const { session, call } = tools({ open: async () => pages.shift() ?? blankJobPage() });
    await call("search_careers");
    await call("open_link", { link: 2, as: "job_page" });
    await call("open_link", { link: 2, as: "job_page" });
    await expect(call("finish_lookup", { found: true })).rejects.toThrow("no text");
    await call("open_link", { link: 2, as: "job_page" });
    await call("finish_lookup", { found: true });
    expect(session.jobPage?.text).toContain("Ship it.");
});

test("open_link on a refused address is a tool error and is remembered as fetch_refused", async () => {
    const { session, call } = tools({ open: () => Promise.reject(new FetchRefused("refused: the address is not on the public internet")) });
    await call("search_careers");
    await expect(call("open_link", { link: 1, as: "job_page" })).rejects.toThrow("not on the public internet");
    expect(session.lastFailure).toBe("fetch_refused");
});

test("a careers page shows the job sought and numbered links without addresses, within the size limit", async () => {
    const filler = Array.from({ length: 80 }, (_, index) => ({ title: `Account Executive ${index}`, href: `ae-${index}` }));
    const { session, call } = tools({ open: async () => page(listingPage([...filler, { title: JOB.title, href: "backend" }]), 2000) });
    await call("search_careers");
    const shown = (await call("open_link", { link: 1, as: "careers_page" })) as { looking_for: unknown; links: Array<{ n: number; text: string }> };
    expect(shown.looking_for).toEqual({ title: JOB.title, company: JOB.company, location: JOB.location });
    expect(shown.links[0]).toEqual({ n: 3, text: JOB.title });
    expect(JSON.stringify(shown)).not.toContain("https://acme.example/careers/ae-");
    expect(session.registry.get(3)).toBe("https://acme.example/careers/backend");
    expect(JSON.stringify(shown).length).toBeLessThanOrEqual(2200);
});

test("a job page is shown without links", async () => {
    const { call } = tools();
    await call("search_careers");
    expect(await call("open_link", { link: 2, as: "job_page" })).toMatchObject({ links: [], more_pages: false });
});

test("a careers page with no job links says so", async () => {
    const { call } = tools({ open: async () => page(scriptOnlyPage()) });
    await call("search_careers");
    expect(await call("open_link", { link: 1, as: "careers_page" })).toMatchObject({ links: [], note: "no job links on this page" });
});

test("finish_lookup with found needs a job page opened first", async () => {
    const { session, call } = tools();
    await expect(call("finish_lookup", { found: true })).rejects.toThrow("open the job's own page");
    expect(session.finished).toBeNull();
});

test("finish_lookup without found needs a reason, and either finish ends the lookup", async () => {
    const { session, call } = tools();
    await expect(call("finish_lookup", { found: false })).rejects.toThrow("give a reason");
    await call("finish_lookup", { found: false, reason: "no_careers_page" });
    expect(session.finished).toEqual({ found: false, reason: "no_careers_page" });
    const found = tools();
    await found.call("search_careers");
    await found.call("open_link", { link: 2, as: "job_page" });
    await found.call("finish_lookup", { found: true });
    expect(found.session.finished).toEqual({ found: true, reason: null });
});
