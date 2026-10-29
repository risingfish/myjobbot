import { expect, test } from "vitest";
import { fetchAndIngest } from "../src/sources/ingest.js";
import { greenhouse } from "../src/sources/modules/greenhouse.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";

test("each fetched page is stored under its saved source's id and name, and offered under that source only", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"])) });
    const stripe = { id: 7, name: "Stripe" };
    const batch = { source: stripe, name: "Stripe", scope: greenhouse.scope, seen: TEST_NOW.toISOString() };
    const result = await fetchAndIngest(context, { module: greenhouse, params: { slug: "stripe" }, batch });
    expect(result).toMatchObject({ skippedPublishers: 0, skippedCopies: 0 });
    const offered = [await context.store.unscoredForSource(stripe), await context.store.unscoredForSource("Stripe"), await context.store.unscoredForSource({ id: 8, name: "Stripe" })];
    expect(offered.map((rows) => rows.map((row) => row.job_id))).toEqual([["1000"], ["1000"], []]);
});
