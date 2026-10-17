import { expect, test } from "vitest";
import { FetchRefused } from "../src/careers/fetchPage.js";
import { readPage } from "../src/careers/readPage.js";
import { trimPage } from "../src/careers/trim.js";
import { listingPage } from "./helpers/careersPages.js";
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
