import { expect, test } from "vitest";
import { newSession } from "../src/careers/session.js";
import { lookupTools } from "../src/careers/tools.js";
import { buildTools } from "../src/tools/registry.js";
import { JOB } from "./helpers/careersLookup.js";
import { testContext } from "./helpers/context.js";

test("exactly the tools that return outside text declare it", () => {
    const ports = { search: async () => [], open: () => Promise.reject(new Error("unused")), audit: async () => {}, forget: async () => {} };
    const tools = [...buildTools(testContext()), ...lookupTools(newSession(JOB), ports)];
    const declared = Object.fromEntries(tools.map((tool) => [tool.name, tool.outsideText]));
    expect(declared).toEqual({ list_sources: false, next_jobs: true, get_job_details: true, record_matches: false, finish: false, search_careers: true, open_link: true, finish_lookup: false });
});
