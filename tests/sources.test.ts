import { expect, test } from "vitest";
import { readAll, type SourceHttp } from "../src/sources/module.js";
import { moduleFor } from "../src/sources/registry.js";
import { loadFixture } from "./helpers/fixtures.js";
import { fakeBoard } from "./helpers/http.js";

function boardJobs(id: string, slug: string, http: SourceHttp) {
    const board = moduleFor(id);
    if (board === null) throw new Error(`no module ${id}`);
    return readAll(board, { slug }, { http, sourceName: "Acme" });
}

const CASES = [
    {
        ats: "greenhouse" as const,
        slug: "stripe",
        url: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
        count: 2,
        first: {
            jobId: "8172503",
            title: "Backend Engineer, Payments",
            url: "https://stripe.com/jobs/search?gh_jid=8172503",
            location: "Remote from the US",
            postedAt: "2026-09-09T14:52:09.000Z",
            description: "Build payments \\& billing\u00a0systems.\n\n-   Go\n-   Ruby \\& Rails",
            descriptionFormat: "markdown",
        },
    },
    {
        ats: "lever" as const,
        slug: "palantir",
        url: "https://api.lever.co/v0/postings/palantir?mode=json",
        count: 2,
        first: {
            jobId: "10dfc8bc-99ad-4ca2-ab76-853cb90a92c2",
            title: "Backend Software Engineer - Application Development",
            location: "London, United Kingdom",
            team: "Dev",
            workplaceType: "hybrid",
            postedAt: "2024-03-11T20:25:07.256Z",
            description: "**Backend Software Engineers** at Palantir build software at scale.\n\n### What We Require\n\n-   Strong engineering background\n-   Go \\& Java\n\n### R\\&D \\<Labs>\n\n-   Distributed systems\n\nPalantir is an equal opportunity employer.",
            descriptionFormat: "markdown",
        },
    },
    {
        ats: "ashby" as const,
        slug: "openai",
        url: "https://api.ashbyhq.com/posting-api/job-board/openai?includeCompensation=true",
        count: 1,
        first: {
            jobId: "240d459b-696d-43eb-8497-fab3e56ecd9b",
            title: "Software Engineer, Infrastructure",
            department: "Engineering",
            team: "Infrastructure",
            location: "San Francisco",
            isRemote: false,
            workplaceType: "Hybrid",
            compensation: "$250K - $445K, Offers Equity",
            postedAt: "2025-04-05T00:03:20.653Z",
        },
    },
];

test.each(CASES)("$ats adapter requests the board and normalizes postings", async (example) => {
    const http = fakeBoard(loadFixture(`${example.ats}.json`));
    const jobs = await boardJobs(example.ats, example.slug, http);
    expect(http.urls).toEqual([example.url]);
    expect(jobs).toHaveLength(example.count);
    expect(jobs[0]).toMatchObject({ ats: example.ats, company: "Acme", ...example.first });
});

test("greenhouse adapter maps missing optional fields to null", async () => {
    const jobs = await boardJobs("greenhouse", "stripe", fakeBoard(loadFixture("greenhouse.json")));
    expect(jobs[1]).toMatchObject({ location: null, postedAt: null, description: null });
});

test("ashby adapter stores the posting's HTML as Markdown, leaving out anything unsafe", async () => {
    const jobs = await boardJobs("ashby", "openai", fakeBoard(loadFixture("ashby.json")));
    expect(jobs[0]).toMatchObject({ descriptionFormat: "markdown", description: "## About the role\n\nBuild the infrastructure that trains **frontier models**.\n\n-   Kubernetes\n-   Go" });
});

test("an ashby posting without HTML has no description", async () => {
    const board = { jobs: [{ id: "x", title: "Engineer", jobUrl: "https://jobs.ashbyhq.com/acme/x", descriptionPlain: "plain only", isListed: true }] };
    expect((await boardJobs("ashby", "acme", fakeBoard(board)))[0]).toMatchObject({ description: null });
});

test("greenhouse's escaped HTML is decoded once, so escaped markup inside it stays words", async () => {
    const board = { jobs: [{ id: 1, title: "Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/1", content: "&lt;h2&gt;Role&lt;/h2&gt;&lt;p&gt;a &amp;lt;script&amp;gt;x&amp;lt;/script&amp;gt; b&lt;/p&gt;" }] };
    expect((await boardJobs("greenhouse", "acme", fakeBoard(board)))[0]).toMatchObject({ description: "## Role\n\na \\<script>x\\</script> b", descriptionFormat: "markdown" });
});

test("a lever posting with no lists or closing section keeps just its opening, and one with nothing has no description", async () => {
    const board = [
        { id: "a", text: "Engineer", hostedUrl: "https://jobs.lever.co/acme/a", description: "<p>Opening only.</p>" },
        { id: "b", text: "Engineer", hostedUrl: "https://jobs.lever.co/acme/b" },
    ];
    const jobs = await boardJobs("lever", "acme", fakeBoard(board));
    expect(jobs.map((job) => job.description)).toEqual(["Opening only.", null]);
});
