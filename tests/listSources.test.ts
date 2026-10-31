import { expect, test } from "vitest";
import { GmailError } from "../src/gmail/imapErrors.js";
import { alertContext } from "./helpers/alertContext.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchRun, invokeTool, nextPage } from "./helpers/tools.js";

const STRIPE = { name: "Stripe", module: "greenhouse" };
const ALERTS = { name: "Gmail alerts", module: "gmail_alerts" };

test("before the run's fetch, list_sources names each source that is on, its module, and nothing fetched, leaving out Gmail alerts while Gmail isn't connected", async () => {
    expect(await invokeTool(testContext(), "list_sources", {})).toEqual([{ ...STRIPE, fetch: "not fetched", total_unscored: 0 }]);
});

test("list_sources reports a failing source with its fixed reason, and a skipped one with why", async () => {
    const context = testContext({ http: { getJson: () => Promise.reject(new Error("down at https://secret.example/")) } });
    context.gmail.connected = true;
    await fetchRun(context);
    expect(await invokeTool(context, "list_sources", {})).toEqual([
        { ...STRIPE, fetch: "failing", reason: "unexpected answer", total_unscored: 0 },
        { ...ALERTS, fetch: "skipped", reason: "not set up", total_unscored: 0 },
    ]);
});

test("a source that is off isn't listed", async () => {
    const context = testContext();
    context.saved.list = context.saved.list.map((source) => (source.name === "Stripe" ? { ...source, enabled: false } : source));
    expect(await invokeTool(context, "list_sources", {})).toEqual([]);
});

test("list_sources reports the jobs left to score once a board has been fetched", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
    const page = await nextPage(context, "Stripe");
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: page.jobs[0]?.job_id, base: 50, bonus: 30 }] });
    expect((await invokeTool(context, "list_sources", {})) as unknown[]).toContainEqual({ ...STRIPE, fetch: "ok", total_unscored: 1 });
});

test("the Gmail alerts source shows why it wasn't read, when Gmail can't be reached", async () => {
    const offline = await alertContext({ fail: new GmailError("unreachable") });
    await fetchRun(offline);
    expect((await invokeTool(offline, "list_sources", {})) as unknown[]).toContainEqual({ ...ALERTS, fetch: "failing", reason: "unreachable", total_unscored: 0 });
});
