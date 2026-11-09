import { expect, test } from "vitest";
import { newSession } from "../src/careers/session.js";
import { lookupTools } from "../src/careers/tools.js";
import { caseStore, caseTools } from "../src/evals/caseTools.js";
import { parseFile } from "../src/evals/format.js";
import { oneJobStore } from "../src/rescore/oneJobStore.js";
import { rescoreTools } from "../src/rescore/tools.js";
import { dataMarkers } from "../src/agent/markers.js";
import type { ChatFn } from "../src/agent/llm.js";
import type { Tool } from "../src/tools/tool.js";
import { extractProfile } from "../src/resumeProfile/extract.js";
import { textReply } from "./helpers/chat.js";
import { memoryTrace } from "./helpers/trace.js";
import { buildTools } from "../src/tools/registry.js";
import { JOB } from "./helpers/careersLookup.js";
import { evalCase } from "./helpers/evalFixtures.js";
import { testAppSettings } from "./helpers/config.js";
import { testContext } from "./helpers/context.js";
import { memoryStores } from "./helpers/memoryStore.js";

async function profileTools(): Promise<Tool[]> {
    let offered: Tool[] = [];
    const chat: ChatFn = async (_messages, tools) => {
        offered = tools;
        return textReply("no");
    };
    await extractProfile({ text: "" }, { chat, trace: memoryTrace(), markers: dataMarkers("profile-1"), limits: testAppSettings().agent, clock: Date.now });
    return offered;
}

test("exactly the tools that return outside text declare it, an eval case's and the profile extraction's own included", async () => {
    const ports = { search: async () => [], open: () => Promise.reject(new Error("unused")), audit: async () => {}, forget: async () => {} };
    const key = { ats: "greenhouse", jobId: "1" };
    const rescoring = rescoreTools({ store: oneJobStore(memoryStores().jobStore, key), postings: memoryStores().postings, key, config: testAppSettings(), now: () => new Date(), runId: "rescore-1" });
    const tools = [...buildTools(testContext()), ...lookupTools(newSession(JOB), ports), ...rescoring];
    const declared = Object.fromEntries(tools.map((tool) => [tool.name, tool.outsideText]));
    expect(declared).toEqual({ list_sources: false, next_jobs: true, get_job_details: true, record_matches: false, finish: false, search_careers: true, open_link: true, finish_lookup: false, get_job: true });
    const parsed = parseFile("case", evalCase());
    const evaluating = parsed.ok ? caseTools(parsed.value, caseStore(parsed.value), { recorded: false, calls: 0, failures: 0 }) : [];
    expect(evaluating.map((tool) => [tool.name, tool.outsideText])).toEqual([
        ["get_job", true],
        ["record_matches", false],
    ]);
    expect((await profileTools()).map((tool) => [tool.name, tool.outsideText])).toEqual([
        ["get_resume", true],
        ["record_profile", false],
    ]);
});
