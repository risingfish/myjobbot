import { expect, test } from "vitest";
import { RunTally } from "../src/monitoring/tally.js";

const NONE = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };

test("a tally counts fetches, failures and jobs found from the fetch events", () => {
    const tally = new RunTally();
    tally.write({ type: "source_fetch", source: "Acme", module: "greenhouse", pages: 1, jobs: 4, cost: 0, outcome: "ok" });
    tally.write({ type: "source_fetch", source: "Beta", module: "lever", pages: 0, jobs: 0, cost: 0, outcome: "failing", reason: "http_404" });
    tally.write({ type: "source_skipped", source: "JSearch", reason: "budget_used" });
    tally.write({ type: "source_skipped", source: "Old board", reason: "off" });
    tally.write({ type: "source_fetch_failed", source: "Gamma", reason: "other" });
    expect(tally.totals()).toEqual({ ...NONE, fetches: 4, fetchFailures: 2, jobsFound: 4 });
});

test("a tally counts company searches, their failures, and the jobs the model scored", () => {
    const tally = new RunTally();
    tally.write({ type: "company_search", company: "Acme", website: "found", careers: "none" });
    tally.write({ type: "company_search", company: "Beta", website: "none", careers: "none" });
    tally.write({ type: "company_search_failed", error: "boom" });
    tally.write({ type: "jobs_scored", count: 3 });
    tally.write({ type: "jobs_scored", count: 2 });
    expect(tally.totals()).toEqual({ ...NONE, searches: 2, searchFailures: 1, jobsScored: 5 });
});

test("a tally counts each model response and its tokens, a response without usage as a call alone", () => {
    const tally = new RunTally();
    tally.write({ type: "llm_response", response: { choices: [], usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } } });
    tally.write({ type: "llm_response", response: { choices: [] } });
    expect(tally.totals()).toEqual({ ...NONE, modelCalls: 2, promptTokens: 120, completionTokens: 30 });
});

test("a tally ignores events it doesn't count and events whose fields don't parse", () => {
    const tally = new RunTally();
    tally.write({ type: "tool", name: "record_matches", content: "text" });
    tally.write({ type: "source_fetch", jobs: "four" });
    tally.write({ type: "jobs_scored", count: -1 });
    tally.write({ type: "llm_response", response: { usage: { prompt_tokens: "many" } } });
    tally.write({ notype: true });
    expect(tally.totals()).toEqual(NONE);
});
