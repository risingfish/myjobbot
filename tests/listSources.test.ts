import { expect, test } from "vitest";
import { z } from "zod";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard, flakyBoard } from "./helpers/http.js";
import { GmailError } from "../src/gmail/imapErrors.js";
import { alertContext } from "./helpers/alertContext.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

const UNFETCHED = { name: "Stripe", kind: "board", ats: "greenhouse", fetched: false };
const ALERTS = { name: "Gmail alerts", kind: "alerts", fetched: false, fetch_failed: true, note: "Gmail not connected" };

async function lastSource(context: Parameters<typeof invokeTool>[0]) {
    return z
        .array(z.unknown())
        .parse(await invokeTool(context, "list_sources", {}))
        .at(-1);
}

function failingBoard() {
    return { getJson: () => Promise.reject(new Error("down")) };
}

test("list_sources returns each board with its kind, board type, and run progress", async () => {
    expect(await invokeTool(testContext(), "list_sources", {})).toEqual([UNFETCHED, ALERTS]);
});

test("list_sources flags fetch_failed when the cached fetch rejected", async () => {
    const context = testContext({ http: failingBoard() });
    await expect(invokeTool(context, "fetch_jobs", { source: "Stripe" })).rejects.toThrow();
    expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetch_failed: true }, ALERTS]);
});

test("list_sources clears fetch_failed once a retry succeeds", async () => {
    const context = testContext({ http: flakyBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
    await expect(invokeTool(context, "fetch_jobs", { source: "Stripe" })).rejects.toThrow();
    await invokeTool(context, "fetch_jobs", { source: "Stripe" });
    expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetched: true, total_unscored: 2 }, ALERTS]);
    context.run.fetches.delete("Stripe");
    expect(await invokeTool(context, "list_sources", {})).toEqual([UNFETCHED, ALERTS]);
});

test("list_sources reports total_unscored once a board has been fetched", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
    const page = await fetchPage(context, "Stripe");
    await invokeTool(context, "record_matches", { verdicts: [{ job_id: page.jobs[0]?.job_id, base: 50, bonus: 30 }] });
    expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetched: true, total_unscored: 1 }, ALERTS]);
});

test("the Gmail alerts source shows why it can't be fetched, before and after a fetch attempt", async () => {
    const context = testContext();
    await expect(invokeTool(context, "fetch_jobs", { source: "Gmail alerts" })).rejects.toThrow("Gmail not connected");
    expect(await lastSource(context)).toEqual(ALERTS);
    const offline = await alertContext({ fail: new GmailError("unreachable") });
    await expect(invokeTool(offline, "fetch_jobs", { source: "Gmail alerts" })).rejects.toThrow();
    expect(await lastSource(offline)).toEqual({ ...ALERTS, note: "Gmail couldn't be reached" });
});
