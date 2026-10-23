import { expect, test } from "vitest";
import { FetchRefused } from "../src/careers/fetchPage.js";
import { readPage } from "../src/careers/readPage.js";
import { trimPage } from "../src/careers/trim.js";
import { ashbyBoard } from "./helpers/boardData.js";
import { listingPage, scriptOnlyPage } from "./helpers/careersPages.js";
import { fakeBrowser } from "./helpers/fakeBrowser.js";
import { fakeDns } from "./helpers/fakeDns.js";
import { CAREERS_URL, JOB, lookupSetup } from "./helpers/careersLookup.js";

const LISTING = listingPage([{ title: JOB.title, href: "backend" }]);

test("a page is read by plain download and trimmed as trimPage would, marked as html", async () => {
    const { deps } = await lookupSetup({ pages: { [CAREERS_URL]: LISTING } });
    const read = await readPage(deps, { url: CAREERS_URL, kind: "careers_page", sought: JOB.title });
    expect(read).toEqual({ ...trimPage(LISTING, { baseUrl: CAREERS_URL, maxChars: deps.settings.page_chars, sought: JOB.title, links: true }), source: "html", fallback: null, board: null, description: null });
});

test("a refused download is rethrown unchanged", async () => {
    const { deps } = await lookupSetup({});
    await expect(readPage(deps, { url: "http://acme.example:8080/careers", kind: "careers_page", sought: JOB.title })).rejects.toBeInstanceOf(FetchRefused);
});

const ASHBY_DATA = "https://api.ashbyhq.com/posting-api/job-board/Acme?includeCompensation=true";
const ASHBY_JOB = "https://jobs.ashbyhq.com/Acme/b2";

test("a board link is read from the board's data, without downloading the page", async () => {
    const { deps } = await lookupSetup({ boards: { [ASHBY_DATA]: ashbyBoard([{ id: "b2", title: JOB.title, location: "Remote" }]) } });
    expect(await readPage(deps, { url: ASHBY_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ source: "board", board: "ashby:Acme", fallback: null, text: expect.stringContaining("builds APIs.") });
});

test("a board whose data can't be read falls back to downloading the page", async () => {
    const { deps } = await lookupSetup({ pages: { [ASHBY_JOB]: LISTING } });
    expect(await readPage(deps, { url: ASHBY_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ source: "html", fallback: "board_failed", board: null });
});

test("a board link whose data address is refused is not fallen back from", async () => {
    const { deps } = await lookupSetup({ pages: { [ASHBY_JOB]: LISTING } });
    const refusing = { ...deps, pages: { ...deps.pages, lookup: fakeDns({ "api.ashbyhq.com": ["10.0.0.5"] }) } };
    await expect(readPage(refusing, { url: ASHBY_JOB, kind: "job_page", sought: JOB.title })).rejects.toBeInstanceOf(FetchRefused);
});

const BLANK_JOB = "https://acme.example/careers/backend";

test("a job page with no text, or a careers page with no job links, is rendered and trimmed as usual", async () => {
    const browser = fakeBrowser({ html: listingPage([{ title: JOB.title, href: "backend" }]), finalUrl: CAREERS_URL });
    const { deps } = await lookupSetup({ pages: { [CAREERS_URL]: scriptOnlyPage(), [BLANK_JOB]: scriptOnlyPage() }, connect: async () => browser.port });
    expect(await readPage(deps, { url: CAREERS_URL, kind: "careers_page", sought: JOB.title })).toMatchObject({ source: "rendered", fallback: null, links: [{ text: JOB.title, url: BLANK_JOB }] });
    expect(await readPage(deps, { url: BLANK_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ source: "rendered", text: expect.stringContaining(JOB.title) });
});

test("a readable page is never rendered", async () => {
    const browser = fakeBrowser();
    const { deps } = await lookupSetup({ pages: { [CAREERS_URL]: LISTING }, connect: async () => browser.port });
    expect(await readPage(deps, { url: CAREERS_URL, kind: "careers_page", sought: JOB.title })).toMatchObject({ source: "html" });
    expect(browser.calls).toEqual([]);
});

test("with rendering off, or after it fails, the unreadable page is returned with the fallbacks listed in order", async () => {
    const off = await lookupSetup({ pages: { [BLANK_JOB]: scriptOnlyPage(), [ASHBY_JOB]: scriptOnlyPage() } });
    expect(await readPage(off.deps, { url: BLANK_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ source: "html", fallback: "render_off", text: "" });
    expect(await readPage(off.deps, { url: ASHBY_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ fallback: "board_failed,render_off" });
    const failing = await lookupSetup({ pages: { [BLANK_JOB]: scriptOnlyPage() }, connect: () => Promise.reject(new Error("ECONNREFUSED")) });
    expect(await readPage(failing.deps, { url: BLANK_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ source: "html", fallback: "render_failed" });
});

test("a rendered page that ends on a private address is a refused fetch, and a board page is never rendered", async () => {
    const browser = fakeBrowser({ finalUrl: "http://192.168.1.1/admin" });
    const { deps } = await lookupSetup({ pages: { [BLANK_JOB]: scriptOnlyPage() }, boards: { [ASHBY_DATA]: ashbyBoard([]) }, connect: async () => browser.port });
    await expect(readPage(deps, { url: BLANK_JOB, kind: "job_page", sought: JOB.title })).rejects.toBeInstanceOf(FetchRefused);
    expect(await readPage(deps, { url: ASHBY_JOB, kind: "job_page", sought: JOB.title })).toMatchObject({ source: "board", text: "", note: "this posting is no longer listed" });
    expect(browser.calls.filter((call) => call.startsWith("goto"))).toEqual([`goto ${BLANK_JOB}`]);
});
