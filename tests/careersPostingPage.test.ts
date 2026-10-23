import { expect, test } from "vitest";
import { postingPage } from "../src/careers/postingPage.js";

const POSTING = { title: "Backend Engineer", location: "Remote", url: "https://jobs.example/1", postingId: "1" };

test("a Markdown posting shows the model its title, location and link words, and keeps the Markdown to store", () => {
    const description = "## Role\n\nBuild [our APIs](https://acme.example/apis).";
    const page = postingPage({ ...POSTING, description, format: "markdown" });
    expect(page.text).toBe("Backend Engineer\nRemote\n\n## Role\n\nBuild our APIs.");
    expect(page.description).toEqual({ text: description, format: "markdown" });
});

test("a plain-text posting shows today's page text and keeps its text to store", () => {
    const page = postingPage({ ...POSTING, location: null, description: "Build APIs.", format: "text" });
    expect([page.text, page.description]).toEqual(["Backend Engineer\n\nBuild APIs.", { text: "Build APIs.", format: "text" }]);
});

test("a blank or missing description gives nothing to store", () => {
    for (const description of ["  \n ", null]) expect(postingPage({ ...POSTING, description, format: "text" }).description).toBeNull();
});

test("a posting the board no longer lists is an empty page that says so", () => {
    expect(postingPage(null)).toEqual({ text: "", links: [], note: "this posting is no longer listed", description: null });
});
