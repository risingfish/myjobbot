import { expect, test } from "vitest";
import { observedRead } from "../src/evals/observedRead.js";

const call = (name: string, args: unknown) => JSON.stringify({ type: "assistant", tool_calls: [{ type: "function", id: "c1", function: { name, arguments: JSON.stringify(args) } }] });

test("a run read the job in full when it called get_job_details for its id, whether sent as text or as a number", () => {
    const run = [JSON.stringify({ type: "start" }), call("next_jobs", { source: "Stripe" }), call("get_job_details", { job_id: 4012345 })];
    expect([observedRead(run, "4012345"), observedRead([call("get_job_details", { job_id: "4012345" })], "4012345"), observedRead(run, "999"), observedRead(["not json", call("record_matches", {})], "4012345")]).toEqual(["details", "details", "summary", "summary"]);
});

test("a re-score of the job read it in full when it called get_job, and no trace means unknown", () => {
    const rescore = [JSON.stringify({ type: "rescore", ats: "greenhouse", job_id: "4012345" }), call("get_job", {})];
    expect([observedRead(rescore, "4012345"), observedRead([JSON.stringify({ type: "rescore", ats: "greenhouse", job_id: "4012345" })], "4012345"), observedRead(null, "4012345")]).toEqual(["details", "summary", "unknown"]);
});
