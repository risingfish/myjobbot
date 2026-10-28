import { expect, test } from "vitest";
import { workday } from "../src/sources/modules/workday.js";
import { workdayDetail, workdaySearch } from "./helpers/boardData.js";

const BOARD = { host: "acme.wd5.myworkdayjobs.com", tenant: "acme", site: "Acme_Careers" };
const BASE = "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Acme_Careers";

function search(http: ReturnType<typeof answering>, text: string) {
    if (workday.postings?.search === undefined) throw new Error("Workday can't search");
    return workday.postings.search(BOARD, text, http);
}

function posting(http: ReturnType<typeof answering>, path: string) {
    if (workday.postings?.one === undefined) throw new Error("Workday can't read one posting");
    return workday.postings.one(BOARD, path, http);
}

function answering(body: unknown) {
    const calls: Array<{ url: string; body?: unknown }> = [];
    return {
        calls,
        postJson: async (url: string, sent: unknown) => (calls.push({ url, body: sent }), structuredClone(body)),
        getJson: async (url: string) => (calls.push({ url }), structuredClone(body)),
    };
}

test("a Workday search asks the board for the sought title and lists its postings with their addresses", async () => {
    const http = answering(workdaySearch([{ title: "Senior Backend Engineer", path: "/job/Remote/Senior-Backend-Engineer_R1", location: "Remote" }]));
    expect(await search(http, "Senior Backend Engineer")).toEqual([{ title: "Senior Backend Engineer", location: "Remote", url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/Remote/Senior-Backend-Engineer_R1", postingId: "/job/Remote/Senior-Backend-Engineer_R1", description: null, format: "text" }]);
    expect(http.calls).toEqual([{ url: `${BASE}/jobs`, body: { appliedFacets: {}, limit: 20, offset: 0, searchText: "Senior Backend Engineer" } }]);
});

test("a Workday posting is read from its job path, with its raw HTML description as Markdown, never decoded first", async () => {
    const http = answering(workdayDetail("Senior Backend Engineer", "<p>Build APIs &amp; services. Text &lt;b&gt; stays</p><ul><li>TypeScript</li></ul>"));
    const description = "Build APIs \\& services. Text \\<b> stays\n\n-   TypeScript";
    expect(await posting(http, "/job/Remote/Senior-Backend-Engineer_R1")).toEqual({ title: "Senior Backend Engineer", location: "Remote", url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/Remote/Senior-Backend-Engineer_R1", postingId: "/job/Remote/Senior-Backend-Engineer_R1", description, format: "markdown" });
    expect(http.calls).toEqual([{ url: `${BASE}/job/Remote/Senior-Backend-Engineer_R1` }]);
});

test("answers of the wrong shape, and job paths outside the board's jobs, are refused", async () => {
    await expect(search(answering({ jobs: [] }), "x")).rejects.toThrow();
    await expect(posting(answering({}), "/job/x")).rejects.toThrow();
    await expect(posting(answering(workdayDetail("x", "y")), "/../../admin")).rejects.toThrow("not a Workday job path");
});

test("a blank Workday description is none, and a long one is cut at a line break within the limit", async () => {
    expect((await posting(answering(workdayDetail("x", "<p> </p>")), "/job/x_R1")).description).toBeNull();
    const long = Array.from({ length: 2_000 }, (_, index) => `<p>Paragraph ${index} of the posting.</p>`).join("");
    const description = (await posting(answering(workdayDetail("x", long)), "/job/x_R1")).description ?? "";
    expect([description.length <= 20_000, description.endsWith("posting.")]).toEqual([true, true]);
});
