import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchRun, invokeTool, nextPage } from "./helpers/tools.js";
import { makeJob } from "../src/jobs/job.js";

const SUMMARY = { summary: "done" };

test("finish is refused while a source still has unscored jobs from an earlier run", async () => {
    const context = testContext();
    await context.store.upsertAll([makeJob({ ats: "greenhouse", jobId: "900", company: "Stripe", title: "Backend Engineer", url: "https://x" }, {})], "2026-10-01T00:00:00.000Z", { id: 1, name: "Stripe" });
    expect(await invokeTool(context, "finish", SUMMARY)).toMatchObject({ ok: false, not_done: ["Stripe: 1 unscored"] });
    expect(context.run.finished).toBe(false);
});

test("finish is refused while fetched jobs are still unscored", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"])) });
    await nextPage(context, "Stripe");
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 30, bonus: 30 }] });
    expect(await invokeTool(context, "finish", SUMMARY)).toMatchObject({ ok: false, not_done: ["Stripe: 1 unscored"] });
});

test("finish ends the run once every source is fetched and scored", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"])) });
    await nextPage(context, "Stripe");
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 30, bonus: 30 }] });
    expect(await invokeTool(context, "finish", SUMMARY)).toEqual({ ok: true });
    expect(context.run).toMatchObject({ finished: true, summary: "done" });
});

test("a source whose fetch failed, with nothing left to score, does not block finish", async () => {
    const context = testContext();
    await fetchRun(context);
    expect([context.run.sources.get("Stripe")?.outcome, await invokeTool(context, "finish", SUMMARY)]).toEqual(["failing", { ok: true }]);
});
