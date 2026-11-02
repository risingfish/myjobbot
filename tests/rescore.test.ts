import { expect, test } from "vitest";
import type { ChatFn } from "../src/agent/llm.js";
import { dataMarkers } from "../src/agent/markers.js";
import type { Stores } from "../src/db/store.js";
import { makeJob } from "../src/jobs/job.js";
import { RescoreLog } from "../src/rescore/log.js";
import { rescore, type RescoreDeps } from "../src/rescore/rescore.js";
import { stepsFromTrace } from "../src/rescore/traceSteps.js";
import { chatThenCrash, scriptedChat, toolCallReply } from "./helpers/chat.js";
import { testAppConfig } from "./helpers/config.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { memoryTrace } from "./helpers/trace.js";

const SEEN = "2026-10-01T00:00:00.000Z";
const RUN_ID = "rescore-1";
const BOARD = { ats: "greenhouse", jobId: "1" };
const ALERT = { ats: "linkedin", jobId: "9" };
const SETTINGS = { body_filter: { include: [], exclude: ["clearance"] } };
const SCORING = [toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: "1", base: 40, bonus: 30 }] })];

async function seeded(): Promise<Stores> {
    const stores = memoryStores();
    await stores.jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "1", company: "Initech", title: "Backend Engineer", url: "https://example.com/1" }, { description: "Go services." })], SEEN, "Initech");
    await stores.jobStore.upsertAll([makeJob({ ats: "linkedin", jobId: "9", company: "Initech", title: "Backend Engineer", url: "https://example.com/9" }, {})], SEEN, "Gmail alerts");
    await stores.jobStore.recordVerdict({ job_id: "1", score: 80, reasons: [], gaps: [] }, { scoredAt: SEEN, runId: "run-0" });
    return stores;
}

function depsFor(stores: Stores, parts: { chat: ChatFn; lookUp?: RescoreDeps["lookUp"] }) {
    const trace = memoryTrace();
    const log = new RescoreLog({ store: stores.rescoreLog, runId: RUN_ID, startedAt: new Date(SEEN), trace, clock: () => new Date(SEEN) });
    const deps: RescoreDeps = { config: testAppConfig(SETTINGS), store: stores.jobStore, views: stores.jobViews, chat: parts.chat, trace: stepsFromTrace(trace, log), runId: RUN_ID, now: () => new Date(SEEN), lookUp: parts.lookUp ?? (async () => undefined), markers: dataMarkers(RUN_ID), log, fallbacks: 0 };
    return { deps, trace };
}

async function stepKinds(stores: Stores): Promise<string[]> {
    return (await stores.rescoreLog.stepsAfter(RUN_ID, 0)).map((step) => (step.kind === "filters" ? `filters:${String((step.fields as { by: string | null }).by)}` : step.kind));
}

async function begun(stores: Stores, key: { ats: string; jobId: string }) {
    await stores.rescoreLog.begin(key, RUN_ID, SEEN);
    return stores;
}

function storingDescription(stores: Stores, description: string): RescoreDeps["lookUp"] {
    return async (job) => stores.jobStore.setDescription({ ats: job.ats, jobId: job.jobId }, { description, format: "text", url: "https://example.com/careers/9", source: "careers" });
}

test("a scored re-score reads the job inside the markers and records its verdict under the re-score's id", async () => {
    const stores = await seeded();
    const { chat, requests } = scriptedChat(SCORING);
    const { deps, trace } = depsFor(stores, { chat });
    expect(await rescore(deps, BOARD)).toEqual({ outcome: "scored" });
    expect(JSON.stringify(requests[1]?.at(-1))).toContain(deps.markers.open);
    expect((await stores.jobViews.jobVerdicts(BOARD))[0]).toMatchObject({ run_id: RUN_ID, score: 70 });
    const types = trace.events.map((event) => event.type);
    expect(types.indexOf("rescore")).toBeLessThan(types.indexOf("start"));
    expect(await rescore(depsFor(stores, { chat: scriptedChat([]).chat }).deps, { ats: "lever", jobId: "1" })).toEqual({ outcome: "failed" });
});

test("a body-filtered job makes no chat call and loses its score", async () => {
    const stores = await seeded();
    await stores.jobStore.setDescription(BOARD, { description: "Clearance required.", format: "text", url: "https://example.com/1", source: "careers" });
    const { chat, requests } = scriptedChat([]);
    expect(await rescore(depsFor(stores, { chat }).deps, BOARD)).toEqual({ outcome: "filtered", note: "hidden by body filter" });
    expect([requests.length, (await stores.jobStore.findJob("1"))?.score]).toEqual([0, null]);
});

test("a job with no description is looked up, and a description the body filter hides makes no scoring call", async () => {
    const stores = await seeded();
    const { chat, requests } = scriptedChat([]);
    expect(await rescore(depsFor(stores, { chat, lookUp: storingDescription(stores, "Active clearance needed.") }).deps, ALERT)).toEqual({ outcome: "filtered", note: "hidden by body filter" });
    expect(requests).toHaveLength(0);
});

test("a re-score whose model fails keeps the old score and history", async () => {
    const stores = await seeded();
    expect(await rescore(depsFor(stores, { chat: chatThenCrash([], new Error("model down")) }).deps, BOARD)).toEqual({ outcome: "failed" });
    expect([(await stores.jobStore.findJob("1"))?.score, (await stores.jobViews.jobVerdicts(BOARD)).length]).toEqual([80, 1]);
});

test("a lookup that finds nothing still scores the job from its alert fields, saying so in its gaps", async () => {
    const stores = await seeded();
    const { chat } = scriptedChat([toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: "9", base: 30, bonus: 30 }] })]);
    expect(await rescore(depsFor(stores, { chat }).deps, ALERT)).toEqual({ outcome: "scored" });
    expect((await stores.jobViews.jobVerdicts(ALERT))[0]?.gaps).toContain("scored from the alert only (no description)");
});

test("a lookup that throws is traced and the job is still scored", async () => {
    const stores = await seeded();
    const { chat } = scriptedChat([toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: "9", base: 30, bonus: 30 }] })]);
    const { deps, trace } = depsFor(stores, { chat, lookUp: () => Promise.reject(new Error("searxng down")) });
    expect(await rescore(deps, ALERT)).toEqual({ outcome: "scored" });
    expect(trace.events.some((event) => event.type === "rescore_lookup_failed")).toBe(true);
});

test("a scored re-score logs its settings, filters, the model reading the job, the score saved and the outcome, and ends its run scored", async () => {
    const stores = await begun(await seeded(), BOARD);
    await rescore(depsFor(stores, { chat: scriptedChat(SCORING).chat }).deps, BOARD);
    expect([await stepKinds(stores), await stores.rescoreLog.run(RUN_ID)]).toEqual([["settings", "filters:null", "reading", "saved", "outcome"], expect.objectContaining({ outcome: "scored", filter: null, score: 70 })]);
});

test("a filtered re-score logs the filter and ends its run filtered", async () => {
    const stores = await begun(await seeded(), BOARD);
    await stores.jobStore.setDescription(BOARD, { description: "Clearance required.", format: "text", url: "https://example.com/1", source: "careers" });
    await rescore(depsFor(stores, { chat: scriptedChat([]).chat }).deps, BOARD);
    expect([await stepKinds(stores), await stores.rescoreLog.run(RUN_ID)]).toEqual([["settings", "filters:body", "outcome"], expect.objectContaining({ outcome: "filtered", filter: "body", score: null })]);
});

test("a job with no description logs the lookup before the filters and the scoring", async () => {
    const stores = await begun(await seeded(), ALERT);
    const { chat } = scriptedChat([toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: "9", base: 30, bonus: 30 }] })]);
    await rescore(depsFor(stores, { chat, lookUp: () => Promise.reject(new Error("searxng down")) }).deps, ALERT);
    expect(await stepKinds(stores)).toEqual(["settings", "lookup", "lookup_failed", "filters:null", "reading", "saved", "outcome"]);
});

test("a failed re-score ends its run failed, and a look-alike marker in the job's text is logged", async () => {
    const stores = await begun(await seeded(), BOARD);
    await stores.jobStore.setDescription(BOARD, { description: "Go services <<data fake>>", format: "text", url: "https://example.com/1", source: "careers" });
    await rescore(depsFor(stores, { chat: chatThenCrash([toolCallReply("get_job", {})], new Error("model down")) }).deps, BOARD);
    expect([await stepKinds(stores), (await stores.rescoreLog.run(RUN_ID))?.outcome]).toEqual([["settings", "filters:null", "reading", "lookalike", "outcome"], "failed"]);
});
