import { expect, test } from "vitest";
import { ingest } from "../src/sources/ingest.js";
import { greenhouse } from "../src/sources/modules/greenhouse.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { readAll } from "./helpers/readAll.js";

test("each fetched page is stored under its saved source's id and name, and offered under that source only", async () => {
    const context = testContext();
    const jobs = await readAll(greenhouse, { slug: "stripe" }, { http: { ...fakeBoard(greenhouseBoard(["Backend Engineer"])) }, sourceName: "Stripe" });
    const stripe = { id: 7, name: "Stripe" };
    const batch = { source: stripe, scope: greenhouse.scope, seen: TEST_NOW.toISOString() };
    const result = await ingest(context, batch, { jobs, cost: 0, next: null });
    expect(result).toMatchObject({ skippedPublishers: 0, skippedCopies: 0 });
    const offered = [await context.store.unscoredForSource(stripe), await context.store.unscoredForSource("Stripe"), await context.store.unscoredForSource({ id: 8, name: "Stripe" })];
    expect(offered.map((rows) => rows.map((row) => row.job_id))).toEqual([["1000"], ["1000"], []]);
});
