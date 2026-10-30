import { expect, test } from "vitest";
import type { SavedSource } from "../src/db/sourceStore.js";
import { searchUsage, sourceRows } from "../src/web/sourceRows.js";
import { TEST_SEARCH } from "./helpers/config.js";
import { savedSources, STRIPE_BOARD } from "./helpers/savedSources.js";

const READY = { hasSearchKey: true, gmailConnected: true };
const AT = "2026-10-29T15:00:00.000Z";

function fetched(source: SavedSource, last: Partial<NonNullable<SavedSource["last"]>>): SavedSource {
    return { ...source, last: { at: AT, outcome: "ok", jobs: 12, cost: 0, reason: null, ...last } };
}

test("rows show each fetch outcome's text, with when and how many jobs", () => {
    const [board] = savedSources({ companies: [STRIPE_BOARD] }, false);
    if (board === undefined) throw new Error("no board");
    const outcomes = [fetched(board, {}), fetched(board, { outcome: "partial", jobs: 1 }), fetched(board, { outcome: "failing", jobs: 0, reason: "not found" }), board];
    expect(sourceRows(outcomes, READY).map((row) => row.last?.replace(/^\d{4}-\d\d-\d\d \d\d:\d\d/, "<time>") ?? null)).toEqual(["<time>: 12 jobs, ok", "<time>: 1 job, stopped at the limit (continues next run)", "<time>: 0 jobs, failing: not found", null]);
});

test("Gmail alerts is listed only once Gmail is connected, as an account source with no Delete", () => {
    const saved = savedSources({ companies: [STRIPE_BOARD] });
    expect(sourceRows(saved, { ...READY, gmailConnected: false }).map((row) => row.name)).toEqual(["Stripe"]);
    expect(sourceRows(saved, READY).map((row) => [row.module, row.name, row.account])).toEqual([
        ["Greenhouse", "Stripe", false],
        ["Gmail alerts", "Gmail alerts", true],
    ]);
});

test("a source whose module is gone is unavailable, one whose fields fail needs fixing, and a search without its key says so", () => {
    const [board, search] = savedSources({ companies: [STRIPE_BOARD], searches: [TEST_SEARCH] }, false);
    if (board === undefined || search === undefined) throw new Error("no sources");
    const saved = [{ ...board, module: "indeed" }, { ...board, id: 7, params: { slug: "" } }, search];
    expect(sourceRows(saved, { ...READY, hasSearchKey: false }).map((row) => [row.module, row.note])).toEqual([
        ["indeed", "unavailable"],
        ["Greenhouse", "needs fixing"],
        ["JSearch", "needs JSEARCH_API_KEY in .env"],
    ]);
    expect(sourceRows([search], READY)[0]?.note).toBeNull();
});

test("the JSearch line shows this month's requests out of the cap", () => {
    expect(searchUsage(37, 190)).toBe("JSearch requests this month: 37 of 190");
});
