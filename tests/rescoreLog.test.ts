import { expect, test } from "vitest";
import type { RescoreLogStore, StoredStep } from "../src/db/rescoreLogStore.js";
import { RescoreLog } from "../src/rescore/log.js";
import { memoryTrace } from "./helpers/trace.js";

const STARTED = new Date("2026-11-03T10:00:00.000Z");
const NO_USE = { modelCalls: 0, promptTokens: 0, completionTokens: 0 };

function slowStore(order: string[]): RescoreLogStore {
    let delay = 30;
    const store: Partial<RescoreLogStore> = {
        addStep: async (_id: string, step: StoredStep) => {
            delay -= 10;
            await new Promise((resolve) => setTimeout(resolve, delay));
            order.push(`step ${step.seq}`);
        },
        end: async () => void order.push("end"),
    };
    return store as RescoreLogStore;
}

test("steps are numbered at once, timed from the run's start, stored in order, shown as lines, and the end waits for them", async () => {
    const order: string[] = [];
    const lines: string[] = [];
    let now = STARTED.getTime();
    const log = new RescoreLog({ store: slowStore(order), runId: "r", startedAt: STARTED, trace: memoryTrace(), clock: () => new Date((now += 1200)), modelUse: () => NO_USE, onLine: (line, ms) => void lines.push(`${ms} ${line}`) });
    log.step({ kind: "settings", fields: { fallbacks: 0 } });
    log.step({ kind: "reading", fields: {} });
    log.step({ kind: "saved", fields: { score: 72 } });
    await log.end({ outcome: "scored", filter: null, score: 72 });
    expect([order, lines]).toEqual([
        ["step 1", "step 2", "step 3", "end"],
        ["1200 settings loaded", "2400 model reading the job", "3600 model score saved: 72"],
    ]);
});

test("a step the store refuses is traced and the log carries on", async () => {
    const trace = memoryTrace();
    const ended: string[] = [];
    const store = { addStep: () => Promise.reject(new Error("db down")), end: async () => void ended.push("end") } as Partial<RescoreLogStore> as RescoreLogStore;
    const log = new RescoreLog({ store, runId: "r", startedAt: STARTED, trace, clock: () => STARTED, modelUse: () => NO_USE });
    log.step({ kind: "reading", fields: {} });
    await log.end({ outcome: "failed", filter: null, score: null });
    expect([trace.events.map((event) => event.type), ended]).toEqual([["rescore_log_failed"], ["end"]]);
});

test("the end records the model calls and tokens the re-score used", async () => {
    const ended: unknown[] = [];
    const store = { end: async (...args: unknown[]) => void ended.push(args) } as Partial<RescoreLogStore> as RescoreLogStore;
    const use = { modelCalls: 3, promptTokens: 2400, completionTokens: 180 };
    const log = new RescoreLog({ store, runId: "r", startedAt: STARTED, trace: memoryTrace(), clock: () => STARTED, modelUse: () => use });
    await log.end({ outcome: "scored", filter: null, score: 72 });
    expect(ended).toEqual([["r", { outcome: "scored", filter: null, score: 72 }, STARTED.toISOString(), use]]);
});
