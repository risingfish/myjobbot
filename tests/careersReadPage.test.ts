import { expect, test } from "vitest";
import { FetchRefused } from "../src/careers/fetchPage.js";
import { readPage } from "../src/careers/readPage.js";
import { trimPage } from "../src/careers/trim.js";
import { ashbyBoard } from "./helpers/boardData.js";
import { listingPage } from "./helpers/careersPages.js";
import { fakeDns } from "./helpers/fakeDns.js";
import { CAREERS_URL, JOB, lookupSetup } from "./helpers/careersLookup.js";

const LISTING = listingPage([{ title: JOB.title, href: "backend" }]);

test("a page is read by plain download and trimmed as trimPage would, marked as html", async () => {
    const { deps } = await lookupSetup({ pages: { [CAREERS_URL]: LISTING } });
    const read = await readPage(deps, { url: CAREERS_URL, kind: "careers_page", sought: JOB.title });
    expect(read).toEqual({ ...trimPage(LISTING, { baseUrl: CAREERS_URL, maxChars: deps.settings.page_chars, sought: JOB.title, links: true }), source: "html", fallback: null, board: null });
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
