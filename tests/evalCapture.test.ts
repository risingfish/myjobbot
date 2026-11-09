import { expect, test } from "vitest";
import type { VerdictView } from "../src/db/jobViews.js";
import { captureCases } from "../src/evals/captureCommand.js";
import { EvalFiles } from "../src/evals/files.js";
import { makeJob } from "../src/jobs/job.js";
import { asScoredDates, buildCase, profileOf } from "../src/evals/capture.js";
import { testAppConfig } from "./helpers/config.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";
import { memoryStores } from "./helpers/memoryStore.js";

const DAY = 86_400_000;
const CAPTURED = "2026-11-03T18:00:00.000Z";
const before = (ms: number) => new Date(Date.parse(CAPTURED) - ms).toISOString();
const PAYLOAD = { job_id: "4012345", title: "Senior Engineer", location: "Remote", days_open: 19, possible_ghost: true, description: "Build APIs." };

function verdict(overrides: Partial<VerdictView> = {}): VerdictView {
    return { id: 1, run_id: "run-1", scored_at: before(7 * DAY), score: 72, base_score: 40, bonus_score: 32, reasons: ["stack"], gaps: ["kafka"], title: null, company: null, url: null, source: null, ...overrides };
}

async function captureSetup() {
    const stores = memoryStores();
    const jobs = ["a", "b"].map((jobId) => makeJob({ ats: "greenhouse", jobId, company: "Acme", title: `Engineer ${jobId}`, url: `https://example.com/${jobId}` }, { description: "Build APIs." }));
    await stores.jobStore.upsertAll(jobs, "2026-10-01T00:00:00.000Z", "Acme");
    await stores.jobStore.recordVerdict({ job_id: "a", score: 70, base: 40, bonus: 30, reasons: ["stack"], gaps: [] }, { scoredAt: "2026-10-05T00:00:00.000Z", runId: "run-1" });
    const { port, files } = memoryFilePort();
    const lines: string[] = [];
    const deps = { stores, files: new EvalFiles(port), port, config: testAppConfig(), now: () => new Date("2026-10-11T00:00:00.000Z"), print: (line: string) => void lines.push(line) };
    return { stores, files, lines, run: (args: string[]) => captureCases(args, deps) };
}

function input(overrides: Record<string, unknown> = {}) {
    const dates = asScoredDates({ earliestSeen: before(19 * DAY + 6 * 3_600_000), capturedAt: CAPTURED, scoredAt: before(7 * DAY), ghostThresholdDays: 15 });
    return { source: { ats: "greenhouse", jobId: "4012345" }, title: "Senior Engineer", company: "Acme", payload: PAYLOAD, dates, verdict: verdict(), read: "details" as const, descriptionFoundAt: null, profile: "p1", tags: ["remote"], userId: 1, ...overrides };
}

test("a job's age as scored is counted in whole days from when it was first seen to its score, as a run counts it", () => {
    const week = asScoredDates({ earliestSeen: before(19 * DAY + 6 * 3_600_000), capturedAt: CAPTURED, scoredAt: before(7 * DAY + 5 * 3_600_000), ghostThresholdDays: 11 });
    expect(week).toEqual({ dates: { capturedAt: CAPTURED, daysOpenAtCapture: 19, daysOpenAsScored: 12, shiftedDays: 7 }, possibleGhost: true });
});

test("whole days are counted, not subtracted, so a score early in a job's first day reads as day 0", () => {
    const firstDay = asScoredDates({ earliestSeen: before(1.5 * DAY), capturedAt: CAPTURED, scoredAt: before(0.9 * DAY), ghostThresholdDays: 30 });
    expect(firstDay.dates).toEqual({ capturedAt: CAPTURED, daysOpenAtCapture: 1, daysOpenAsScored: 0, shiftedDays: 1 });
});

test("no score, or a score after the capture, keeps the age at capture, and a score before the job was first seen counts as day 0", () => {
    const earliestSeen = before(19 * DAY);
    const unscored = asScoredDates({ earliestSeen, capturedAt: CAPTURED, scoredAt: null, ghostThresholdDays: 10 });
    const skewed = asScoredDates({ earliestSeen, capturedAt: CAPTURED, scoredAt: "2026-11-04T00:00:00.000Z", ghostThresholdDays: 10 });
    const early = asScoredDates({ earliestSeen, capturedAt: CAPTURED, scoredAt: before(25 * DAY), ghostThresholdDays: 10 });
    expect([unscored, skewed.dates.shiftedDays, early]).toEqual([{ dates: { capturedAt: CAPTURED, daysOpenAtCapture: 19, daysOpenAsScored: 19, shiftedDays: 0 }, possibleGhost: true }, 0, { dates: { capturedAt: CAPTURED, daysOpenAtCapture: 19, daysOpenAsScored: 0, shiftedDays: 19 }, possibleGhost: false }]);
});

test("a case holds the job as the model was given it on the day of its score", () => {
    const built = buildCase(input());
    expect(built.ok && built.value.job).toEqual({ ...PAYLOAD, days_open: 12, possible_ghost: false });
    expect(built.ok && [built.value.id, built.value.dates.shiftedDays, built.value.tags]).toEqual(["greenhouse-4012345", 7, ["remote"]]);
});

test("the observed score keeps its parts, reasons, gaps, time, run and how much of the job was read", () => {
    const built = buildCase(input({ read: "summary" }));
    expect(built.ok && built.value.observed).toEqual({ base: 40, bonus: 32, score: 72, reasons: ["stack"], gaps: ["kafka"], scoredAt: before(7 * DAY), runId: "run-1", read: "summary" });
});

test("a job never scored has no observed score and its age at capture", () => {
    const dates = asScoredDates({ earliestSeen: before(19 * DAY), capturedAt: CAPTURED, scoredAt: null, ghostThresholdDays: 15 });
    const built = buildCase(input({ verdict: null, dates }));
    expect(built.ok && [built.value.observed, built.value.job.days_open, built.value.dates.shiftedDays, built.value.descriptionChangedSinceScored]).toEqual([null, 19, 0, false]);
});

test("a description found after the score marks the case, and one found before doesn't", () => {
    const after = buildCase(input({ descriptionFoundAt: before(2 * DAY) }));
    const earlier = buildCase(input({ descriptionFoundAt: before(9 * DAY) }));
    expect([after.ok && after.value.descriptionChangedSinceScored, earlier.ok && earlier.value.descriptionChangedSinceScored]).toEqual([true, false]);
});

test("a job with no description is a valid case", () => {
    const built = buildCase(input({ payload: { ...PAYLOAD, description: "(none provided)" }, source: { ats: "linkedin", jobId: "li_44" } }));
    expect(built.ok && [built.value.id, built.value.job.description]).toEqual(["linkedin-li_44", "(none provided)"]);
});

test("a profile is named by its resume, preferences and thresholds, not by when it was captured", () => {
    const config = testAppConfig({ preferences: "Remote US", match_threshold: 70, ghost_threshold_days: 30 });
    const first = profileOf(config, CAPTURED);
    expect([first.id, first.profile.capturedAt, first.profile.matchThreshold]).toEqual([profileOf(config, "2026-12-01T00:00:00.000Z").id, CAPTURED, 70]);
    expect(profileOf(testAppConfig({ preferences: "Remote EU", match_threshold: 70, ghost_threshold_days: 30 }), CAPTURED).id).not.toBe(first.id);
});

test("capture writes each new job's case and its profile once, leaves an existing case alone unless fresh, and refuses an unknown job", async () => {
    const { stores, files, lines, run } = await captureSetup();
    expect(await run(["greenhouse", "a"])).toBe(0);
    const first = files.get("evals/cases/greenhouse-a.json");
    expect([await run(["greenhouse", "a"]), files.get("evals/cases/greenhouse-a.json")]).toEqual([0, first]);
    expect([await run(["--recent", "2"]), await run(["greenhouse", "b", "--tag", "smoke"]), await run(["lever", "a"]), await run(["greenhouse", "a", "--fresh"])]).toEqual([0, 0, 1, 0]);
    expect(lines).toEqual([
        "captured greenhouse-a · scored 70 (unknown) · 4 days as scored (shift 6)",
        "note: observed scores used the resume and preferences of their time; cases use today's",
        "exists: greenhouse-a",
        "exists: greenhouse-a",
        "captured greenhouse-b · never scored · 10 days open",
        "unknown job lever a",
        "captured greenhouse-a · scored 70 (unknown) · 4 days as scored (shift 6)",
        "note: observed scores used the resume and preferences of their time; cases use today's",
    ]);
    expect([[...files.keys()].filter((path) => path.startsWith("evals/profiles/")).length, (await stores.jobViews.recentlyScored(5)).length]).toEqual([1, 1]);
});
