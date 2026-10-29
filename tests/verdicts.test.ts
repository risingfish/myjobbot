import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { nextPage, invokeTool } from "./helpers/tools.js";
import { FIRST_PAGE } from "./helpers/views.js";

function scoredContext() {
    const stores = memoryStores();
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"])) }, stores);
    return { context, views: stores.jobViews };
}

test("record_matches keeps every verdict as history tagged with the run", async () => {
    const { context, views } = scoredContext();
    await nextPage(context, "Stripe");
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 50, bonus: 10, reasons: ["first"] }] });
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 50, bonus: 35, reasons: ["second"] }] });
    const history = (await views.verdictHistory(FIRST_PAGE)).map((verdict) => [verdict.run_id, verdict.score, verdict.reasons]);
    expect(history).toEqual([
        ["test-run", 85, ["second"]],
        ["test-run", 60, ["first"]],
    ]);
    expect((await views.allJobs(FIRST_PAGE)).find((job) => job.job_id === "1000")).toMatchObject({ score: 85, reasons: ["second"] });
});

test("record_matches writes no history for unknown job ids", async () => {
    const { context, views } = scoredContext();
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: "nope", base: 50, bonus: 10 }] });
    expect(await views.countVerdicts()).toBe(0);
});

test("pruning a job removes its verdict history", async () => {
    const { context, views } = scoredContext();
    await nextPage(context, "Stripe");
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 50, bonus: 10 }] });
    await context.store.pruneLastSeenBefore("2099-01-01T00:00:00.000Z");
    expect(await views.countVerdicts()).toBe(0);
});
