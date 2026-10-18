import { expect, test } from "vitest";
import { reportLookalike } from "../src/app/lookalikes.js";
import { testContext } from "./helpers/context.js";
import { memoryTrace } from "./helpers/trace.js";

test("a removed look-alike is noted in the trace with its tool and job, and nothing else", async () => {
    const trace = memoryTrace();
    await reportLookalike(testContext({ trace }), { tool: "get_job_details", jobId: "a" });
    expect(trace.events).toEqual([{ type: "lookalike_removed", tool: "get_job_details", job_id: "a" }]);
});
