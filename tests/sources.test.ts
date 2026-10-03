import { expect, test } from "vitest";
import { fetcherFor } from "../src/sources/index.js";
import { loadFixture } from "./helpers/fixtures.js";
import { fakeBoard } from "./helpers/http.js";

const CASES = [
  {
    ats: "greenhouse" as const,
    slug: "stripe",
    url: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs",
    count: 2,
    first: {
      jobId: "8172503",
      title: "Backend Engineer, Payments",
      url: "https://stripe.com/jobs/search?gh_jid=8172503",
      location: "Remote from the US",
      postedAt: "2026-09-09T14:52:09.000Z",
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
      description: "Backend Software Engineers at Palantir build software at scale.",
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
  const jobs = await fetcherFor(example.ats)({ name: "Acme", slug: example.slug }, http);
  expect(http.urls).toEqual([example.url]);
  expect(jobs).toHaveLength(example.count);
  expect(jobs[0]).toMatchObject({ ats: example.ats, company: "Acme", ...example.first });
});

test("greenhouse adapter maps missing optional fields to null", async () => {
  const jobs = await fetcherFor("greenhouse")({ name: "Acme", slug: "stripe" }, fakeBoard(loadFixture("greenhouse.json")));
  expect(jobs[1]).toMatchObject({ location: null, postedAt: null, description: null });
});
