import { expect, test } from "vitest";
import { moduleFor } from "../src/sources/registry.js";
import { gemBoard } from "./helpers/boardData.js";
import { fakeBoard } from "./helpers/http.js";
import { readAll } from "./helpers/readAll.js";

const BOARD_DATA = gemBoard([{ id: "j1", title: "Senior Software Engineer", location: "United States - Remote" }], "bigpanda");

function gem() {
    const found = moduleFor("gem");
    if (found === null) throw new Error("no gem module");
    return found;
}

test("the Gem module is a company board that recognises Gem's board and posting addresses", () => {
    const module = gem();
    expect([module.kind, module.scope, module.fromUrl?.(new URL("https://jobs.gem.com/bigpanda")), module.fromUrl?.(new URL("https://jobs.gem.com/bigpanda/j1")), module.fromUrl?.(new URL("https://jobs.lever.co/bigpanda"))]).toEqual(["ats", "company", { slug: "bigpanda" }, { slug: "bigpanda" }, null]);
});

test("the Gem module reads a board's postings into jobs, with their raw HTML descriptions as Markdown", async () => {
    const jobs = await readAll(gem(), { slug: "bigpanda" }, { http: fakeBoard(BOARD_DATA), sourceName: "BigPanda" });
    expect(jobs).toMatchObject([{ ats: "gem", jobId: "j1", company: "BigPanda", title: "Senior Software Engineer", url: "https://jobs.gem.com/bigpanda/j1", location: "United States - Remote", postedAt: "2026-09-14T10:24:59.731Z", description: expect.stringContaining("Senior Software Engineer builds"), descriptionFormat: "markdown" }]);
});
