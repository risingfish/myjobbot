import { expect, test } from "vitest";
import type { JobRowView, PageData, PageName, VerdictRowView } from "../src/web/api.js";
import { loadPageData } from "../src/web/pageData.js";
import { testFileConfig } from "./helpers/config.js";
import { TEST_NOW } from "./helpers/context.js";
import { seededStores, type SeedJob } from "./helpers/views.js";

function pagesOf(jobs: SeedJob[], overrides: Parameters<typeof testFileConfig>[0] = {}) {
    const views = seededStores(jobs).then((stores) => stores.jobViews);
    const config = testFileConfig(overrides);
    return async (name: PageName, offset = 0) => loadPageData(name, { views: await views, config, now: TEST_NOW, page: { offset, limit: 100 } });
}

function jobRows(data: PageData): JobRowView[] {
    if (data.kind !== "jobs") throw new Error(`expected job rows, got ${data.kind}`);
    return data.rows;
}

function verdictRows(data: PageData): VerdictRowView[] {
    if (data.kind !== "verdicts") throw new Error(`expected verdict rows, got ${data.kind}`);
    return data.rows;
}

test("recommended holds jobs at or above the threshold, with their reasoning and publisher", async () => {
    const data = await pagesOf([
        { id: "a", score: 90, publisher: "LinkedIn" },
        { id: "b", score: 40 },
    ])("recommended");
    expect(data.summary).toBe("1 recommended · threshold 70");
    expect(jobRows(data).map((row) => row.title)).toEqual(["Software Engineer a"]);
    expect(jobRows(data)[0]).toMatchObject({ reasons: ["reason a"], gaps: ["gap a"], via: "LinkedIn" });
});

test("title boosts lift a job over the threshold and report the model's own score", async () => {
    const jobs = [
        { id: "t", score: 65, title: "Senior TypeScript Engineer" },
        { id: "j", score: 65, title: "Senior Java Engineer" },
    ];
    const rows = jobRows(await pagesOf(jobs, { title_boosts: { typescript: 10 } })("recommended"));
    expect(rows.map((row) => row.title)).toEqual(["Senior TypeScript Engineer"]);
    expect(rows[0]?.score).toEqual({ value: 75, note: "model 65 · +10 typescript" });
});

test("excluded companies drop out of recommended and are marked in all jobs", async () => {
    const page = pagesOf([{ id: "a", score: 90 }], { exclude_companies: ["acme"] });
    expect(await page("recommended")).toMatchObject({ total: 0, empty: "No recommendations yet: run myjobbot run." });
    expect(jobRows(await page("jobs"))[0]?.filterNote).toBe("hidden: excluded company");
});

test("scores carry the base and bonus breakdown, and boosts count matches in the description", async () => {
    const job = { id: "b", score: 62, parts: { base: 32, bonus: 30 }, description: "Vue and TypeScript." };
    const page = pagesOf([job], { title_boosts: { typescript: 10 } });
    expect(jobRows(await page("recommended"))[0]?.score).toEqual({ value: 72, note: "base 32 + bonus 30 · model 62 · +10 typescript" });
    expect(verdictRows(await page("reasoning"))[0]?.score).toEqual({ value: 62, note: "base 32 + bonus 30" });
});

test("boosts read a Markdown description's words, never its link addresses", async () => {
    const description = "Deploys go through [our platform](https://aws.example.com/deploy). We use Terraform.";
    const page = pagesOf([{ id: "m", score: 62, description, descriptionFormat: "markdown" }], { title_boosts: { aws: 10, terraform: 5 } });
    expect(jobRows(await page("jobs"))[0]?.score?.note).toBe("model 62 · +5 terraform");
    expect(jobRows(await page("recommended"))).toEqual([]);
});

test("all jobs lists every job and marks titles the filter hides", async () => {
    const data = await pagesOf([
        { id: "a", score: 90 },
        { id: "e", title: "Account Executive" },
    ])("jobs");
    expect(data.summary).toBe("2 jobs");
    expect(jobRows(data).find((row) => row.jobId === "e")?.filterNote).toBe("hidden by title filter");
    expect(jobRows(data).find((row) => row.jobId === "a")?.filterNote).toBeNull();
});

test("only http and https postings carry a link", async () => {
    const rows = jobRows(
        await pagesOf([
            { id: "x", url: "javascript:alert(1)" },
            { id: "y", url: "https://example.com/y" },
        ])("jobs"),
    );
    expect(rows.find((row) => row.jobId === "x")?.url).toBeNull();
    expect(rows.find((row) => row.jobId === "y")?.url).toBe("https://example.com/y");
});

test("long-open postings are flagged as possible ghosts", async () => {
    const rows = jobRows(await pagesOf([{ id: "g", score: 90, postedAt: "2026-06-01T00:00:00.000Z" }])("recommended"));
    expect(rows[0]?.posted).toMatchObject({ date: "2026-06-01", ghost: true });
    expect(rows[0]?.posted.daysOpen).toBeGreaterThan(60);
});

test("pages hold 100 rows and say where the next page starts", async () => {
    const page = pagesOf(Array.from({ length: 250 }, (_, index) => ({ id: String(index).padStart(3, "0") })));
    const slices = [await page("jobs"), await page("jobs", 100), await page("jobs", 200)];
    expect(slices.map((data) => [data.rows.length, data.nextOffset, data.total])).toEqual([
        [100, 100, 250],
        [100, 200, 250],
        [50, null, 250],
    ]);
});

test("reasoning lists each verdict with its run and scoring time", async () => {
    const data = await pagesOf([{ id: "a", score: 80 }])("reasoning");
    expect(data.summary).toBe("1 scoring decisions");
    expect(verdictRows(data)[0]).toMatchObject({ run: "run-1", scoredAt: "2026-10-02 00:00", title: "Software Engineer a", gaps: ["gap a"] });
});

test("job rows carry a title cut to 64 characters alongside the full title, and no scoring date", async () => {
    const title = `Senior Software Engineer ${"platform ".repeat(7)}`.trim();
    const rows = jobRows(await pagesOf([{ id: "long", score: 90, title }])("jobs"));
    expect(rows).toMatchObject([{ title, shortTitle: `${title.slice(0, 64).trimEnd()}…` }]);
    expect(rows[0]).not.toHaveProperty("scoredDate");
});

test("a scored Gmail alerts job at or above the threshold is recommended", async () => {
    const data = await pagesOf([{ id: "li_1", score: 90, source: "Gmail alerts" }])("recommended");
    expect(jobRows(data).map((row) => row.jobId)).toEqual(["li_1"]);
});

test("a stored job's row is not applied until marked", async () => {
    expect(jobRows(await pagesOf([{ id: "a", score: 90 }])("jobs"))[0]).toMatchObject({ applied: false, appliedOn: null });
});
