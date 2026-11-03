export const AT = "2026-11-03T18:00:00.000Z";

export function profile(overrides: Record<string, unknown> = {}) {
    return { schema: 1, resume: "TypeScript engineer", preferences: "Remote US", matchThreshold: 70, ghostThresholdDays: 30, capturedAt: AT, ...overrides };
}

export function job(overrides: Record<string, unknown> = {}) {
    return { job_id: "4012345", title: "Senior Engineer", location: "Remote", is_remote: true, days_open: 12, possible_ghost: false, description: "Build APIs.", skills: ["TypeScript"], ...overrides };
}

export function evalCase(overrides: Record<string, unknown> = {}) {
    const observed = { base: 40, bonus: 32, score: 72, reasons: ["stack"], gaps: [], scoredAt: "2026-10-27T13:00:00.000Z", runId: "run-1", read: "details" };
    const dates = { capturedAt: AT, daysOpenAtCapture: 19, daysOpenAsScored: 12, shiftedDays: 7 };
    return { schema: 1, id: "greenhouse-4012345", profile: "p1", source: { ats: "greenhouse", jobId: "4012345" }, title: "Senior Engineer", company: "Acme", job: job(), dates, observed, descriptionChangedSinceScored: false, tags: ["seniority-edge"], ...overrides };
}

export function label(overrides: Record<string, unknown> = {}) {
    return { schema: 1, verdict: "recommend", score: { min: 70, max: 85 }, base: null, bonus: null, mustMention: [], note: "stack matches", labeledAt: AT, history: [], ...overrides };
}

export function run(overrides: Record<string, unknown> = {}) {
    return { schema: 1, id: "20261103-180000-3f2a", model: "qwen3", prompts: { p1: "prompt1" }, repeats: 2, cases: ["greenhouse-4012345"], tags: [], gitCommit: null, startedAt: AT, endedAt: null, ...overrides };
}

export function result(overrides: Record<string, unknown> = {}) {
    return { schema: 1, case: "greenhouse-4012345", attempt: 1, base: 40, bonus: 32, score: 72, reasons: [], gaps: [], failure: null, tokensIn: 4210, tokensOut: 180, ms: 5300, passed: true, ...overrides };
}
