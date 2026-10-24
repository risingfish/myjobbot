import { expect, test } from "vitest";
import { boardPageUrl } from "../src/companies/boardPage.js";
import { parseBoardLink } from "../src/sources/boardLink.js";

test("a Greenhouse company's careers page is its public job board", () => {
    expect(boardPageUrl({ ats: "greenhouse", slug: "stripe" })).toBe("https://job-boards.greenhouse.io/stripe");
});

test("a Lever company's careers page is its public job board", () => {
    expect(boardPageUrl({ ats: "lever", slug: "leverdemo" })).toBe("https://jobs.lever.co/leverdemo");
});

test("an Ashby company's careers page is its public job board", () => {
    expect(boardPageUrl({ ats: "ashby", slug: "ashby" })).toBe("https://jobs.ashbyhq.com/ashby");
});

test("every board address is one the board-link reader recognises, with the same slug", () => {
    const boards = [{ ats: "greenhouse", slug: "stripe" }, { ats: "lever", slug: "leverdemo" }, { ats: "ashby", slug: "ashby" }] as const;
    expect(boards.map((board) => parseBoardLink(boardPageUrl(board))?.slug)).toEqual(["stripe", "leverdemo", "ashby"]);
});
