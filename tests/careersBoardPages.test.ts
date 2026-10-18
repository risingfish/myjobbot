import { expect, test } from "vitest";
import { boardPage } from "../src/careers/boardPages.js";
import { parseBoardLink } from "../src/sources/boardLink.js";
import { ashbyBoard, fakeBoardHttp, workdayDetail, workdaySearch } from "./helpers/boardData.js";
import { publicDns } from "./helpers/fakeDns.js";

const ASHBY_DATA = "https://api.ashbyhq.com/posting-api/job-board/Acme?includeCompensation=true";
const WORKDAY_DATA = "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Acme_Careers";
const POSTINGS = [
    { id: "a1", title: "Data Analyst", location: "Boise" },
    { id: "b2", title: "Senior Backend Engineer", location: "Remote" },
];

interface Opening {
    url: string;
    kind: "careers_page" | "job_page";
    maxChars?: number;
}

function read(opening: Opening, answers: Record<string, unknown>) {
    const http = fakeBoardHttp(answers);
    const link = parseBoardLink(opening.url);
    if (link === null) throw new Error(`not a board link: ${opening.url}`);
    const deps = { boards: { http, cache: new Map() }, lookup: publicDns(), maxChars: opening.maxChars ?? 12_000 };
    return { http, deps, page: () => boardPage(deps, { url: opening.url, link, kind: opening.kind, sought: "Senior Backend Engineer" }) };
}

test("a board opened as a careers page lists its postings with the sought one first", async () => {
    const page = await read({ url: "https://jobs.ashbyhq.com/Acme", kind: "careers_page" }, { [ASHBY_DATA]: ashbyBoard(POSTINGS) }).page();
    expect(page).toMatchObject({ text: "2 open jobs at Acme on Ashby", source: "board", board: "ashby:Acme", fallback: null, morePages: false });
    expect(page.links).toEqual([
        { text: "Senior Backend Engineer — Remote", url: "https://jobs.ashbyhq.com/Acme/b2" },
        { text: "Data Analyst — Boise", url: "https://jobs.ashbyhq.com/Acme/a1" },
    ]);
});

test("a board's posting opened as a job page shows its title, location and description", async () => {
    const page = await read({ url: "https://jobs.ashbyhq.com/Acme/b2", kind: "job_page" }, { [ASHBY_DATA]: ashbyBoard(POSTINGS) }).page();
    expect(page).toMatchObject({ url: "https://jobs.ashbyhq.com/Acme/b2", text: "Senior Backend Engineer\nRemote\n\nSenior Backend Engineer builds APIs.", links: [], cut: false });
});

test("a posting the board no longer lists reads as empty, with a note saying so", async () => {
    expect(await read({ url: "https://jobs.ashbyhq.com/Acme/gone", kind: "job_page" }, { [ASHBY_DATA]: ashbyBoard(POSTINGS) }).page()).toMatchObject({ text: "", note: "this posting is no longer listed" });
});

test("a board is read once per run however many of its pages are opened", async () => {
    const { http, deps } = read({ url: "https://jobs.ashbyhq.com/Acme", kind: "careers_page" }, { [ASHBY_DATA]: ashbyBoard(POSTINGS) });
    const link = parseBoardLink("https://jobs.ashbyhq.com/Acme/b2");
    if (link === null) throw new Error("not a board link");
    await boardPage(deps, { url: "https://jobs.ashbyhq.com/Acme", link: { ...link, postingId: null }, kind: "careers_page", sought: "x" });
    await boardPage(deps, { url: "https://jobs.ashbyhq.com/Acme/b2", link, kind: "job_page", sought: "x" });
    expect(http.calls).toEqual([ASHBY_DATA]);
});

test("a Workday board is searched for the sought title, and a Workday posting read from its job path", async () => {
    const answers = { [`${WORKDAY_DATA}/jobs`]: workdaySearch([{ title: "Senior Backend Engineer", path: "/job/Remote/SBE_R1", location: "Remote" }]), [`${WORKDAY_DATA}/job/Remote/SBE_R1`]: workdayDetail("Senior Backend Engineer", "<p>Build APIs.</p>") };
    const listing = await read({ url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers", kind: "careers_page" }, answers).page();
    expect(listing).toMatchObject({ board: "workday:acme/Acme_Careers", links: [{ text: "Senior Backend Engineer — Remote", url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/Remote/SBE_R1" }] });
    const posting = await read({ url: "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Remote/SBE_R1", kind: "job_page" }, answers).page();
    expect(posting.text).toBe("Senior Backend Engineer\nRemote\n\nBuild APIs.");
});

test("a long board is cut to the page size", async () => {
    const many = Array.from({ length: 300 }, (_, index) => ({ id: `p${index}`, title: `Account Executive ${index}`, location: "Remote" }));
    const page = await read({ url: "https://jobs.ashbyhq.com/Acme", kind: "careers_page", maxChars: 2000 }, { [ASHBY_DATA]: ashbyBoard(many) }).page();
    expect(page.chars).toBeLessThanOrEqual(2000);
    expect(page.cut).toBe(true);
});
