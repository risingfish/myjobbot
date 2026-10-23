import { expect, test } from "vitest";
import { searchWorkday, workdayPosting } from "../src/sources/workday.js";
import { workdayDetail, workdaySearch } from "./helpers/boardData.js";

const BOARD = { host: "acme.wd5.myworkdayjobs.com", slug: "acme", site: "Acme_Careers" };
const BASE = "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Acme_Careers";

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
    expect(await searchWorkday(http, BOARD, "Senior Backend Engineer")).toEqual([{ title: "Senior Backend Engineer", location: "Remote", url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/Remote/Senior-Backend-Engineer_R1", postingId: "/job/Remote/Senior-Backend-Engineer_R1" }]);
    expect(http.calls).toEqual([{ url: `${BASE}/jobs`, body: { appliedFacets: {}, limit: 20, offset: 0, searchText: "Senior Backend Engineer" } }]);
});

test("a Workday posting is read from its job path, with its raw HTML description as Markdown, never decoded first", async () => {
    const http = answering(workdayDetail("Senior Backend Engineer", "<p>Build APIs &amp; services. Text &lt;b&gt; stays</p><ul><li>TypeScript</li></ul>"));
    const description = "Build APIs \\& services. Text \\<b> stays\n\n-   TypeScript";
    expect(await workdayPosting(http, BOARD, "/job/Remote/Senior-Backend-Engineer_R1")).toEqual({ title: "Senior Backend Engineer", location: "Remote", url: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/Remote/Senior-Backend-Engineer_R1", description, format: "markdown" });
    expect(http.calls).toEqual([{ url: `${BASE}/job/Remote/Senior-Backend-Engineer_R1` }]);
});

test("answers of the wrong shape, and job paths outside the board's jobs, are refused", async () => {
    await expect(searchWorkday(answering({ jobs: [] }), BOARD, "x")).rejects.toThrow();
    await expect(workdayPosting(answering({}), BOARD, "/job/x")).rejects.toThrow();
    await expect(workdayPosting(answering(workdayDetail("x", "y")), BOARD, "/../../admin")).rejects.toThrow("not a Workday job path");
});

test("a blank Workday description is none, and a long one is cut at a line break within the limit", async () => {
    expect((await workdayPosting(answering(workdayDetail("x", "<p> </p>")), BOARD, "/job/x_R1")).description).toBeNull();
    const long = Array.from({ length: 2_000 }, (_, index) => `<p>Paragraph ${index} of the posting.</p>`).join("");
    const description = (await workdayPosting(answering(workdayDetail("x", long)), BOARD, "/job/x_R1")).description ?? "";
    expect([description.length <= 20_000, description.endsWith("posting.")]).toEqual([true, true]);
});
