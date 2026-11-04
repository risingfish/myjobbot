import { expect, test } from "vitest";
import { newSession } from "../src/careers/session.js";
import { lookupTools } from "../src/careers/tools.js";
import { caseStore, caseTools } from "../src/evals/caseTools.js";
import { parseFile } from "../src/evals/format.js";
import { oneJobStore } from "../src/rescore/oneJobStore.js";
import { rescoreTools } from "../src/rescore/tools.js";
import { buildTools } from "../src/tools/registry.js";
import { JOB } from "./helpers/careersLookup.js";
import { evalCase } from "./helpers/evalFixtures.js";
import { testAppSettings } from "./helpers/config.js";
import { testContext } from "./helpers/context.js";
import { memoryStores } from "./helpers/memoryStore.js";

test("exactly the tools that return outside text declare it, an eval case's own included", () => {
    const ports = { search: async () => [], open: () => Promise.reject(new Error("unused")), audit: async () => {}, forget: async () => {} };
    const key = { ats: "greenhouse", jobId: "1" };
    const rescoring = rescoreTools({ store: oneJobStore(memoryStores().jobStore, key), key, config: testAppSettings(), now: () => new Date(), runId: "rescore-1" });
    const tools = [...buildTools(testContext()), ...lookupTools(newSession(JOB), ports), ...rescoring];
    const declared = Object.fromEntries(tools.map((tool) => [tool.name, tool.outsideText]));
    expect(declared).toEqual({ list_sources: false, next_jobs: true, get_job_details: true, record_matches: false, finish: false, search_careers: true, open_link: true, finish_lookup: false, get_job: true });
    const parsed = parseFile("case", evalCase());
    const evaluating = parsed.ok ? caseTools(parsed.value, caseStore(parsed.value), { recorded: false, calls: 0, failures: 0 }) : [];
    expect(evaluating.map((tool) => [tool.name, tool.outsideText])).toEqual([
        ["get_job", true],
        ["record_matches", false],
    ]);
});
