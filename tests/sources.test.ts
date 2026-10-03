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
