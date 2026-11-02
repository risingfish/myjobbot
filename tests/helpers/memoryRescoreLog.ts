import { openSince, type BeginResult, type RescoreEnd, type RescoreLogStore, type RescoreRun, type StoredStep } from "../../src/db/rescoreLogStore.js";
import type { JobKey } from "../../src/db/store.js";
import type { Tables } from "./memoryJobViews.js";

export class MemoryRescoreLog implements RescoreLogStore {
    constructor(private readonly tables: Tables) {}

    async begin(key: JobKey, id: string, at: string): Promise<BeginResult> {
        if (!this.tables.jobs.some((job) => job.ats === key.ats && job.job_id === key.jobId)) return { missing: true };
        const open = this.of(key).find((run) => run.endedAt === null && run.startedAt > openSince(at));
        if (open !== undefined) return { running: open.id };
        this.tables.rescoreRuns.push({ id, ats: key.ats, jobId: key.jobId, startedAt: at, endedAt: null, outcome: null, filter: null, score: null });
        return { started: id };
    }

    async end(id: string, result: RescoreEnd, at: string): Promise<void> {
        const run = this.tables.rescoreRuns.find((each) => each.id === id);
        if (run !== undefined) Object.assign(run, { ...result, endedAt: at });
    }

    async addStep(id: string, step: StoredStep): Promise<void> {
        this.tables.rescoreSteps.push({ ...structuredClone(step), runId: id });
    }

    async stepsAfter(id: string, seq: number): Promise<StoredStep[]> {
        const steps = this.tables.rescoreSteps.filter((step) => step.runId === id && step.seq > seq).sort((a, b) => a.seq - b.seq);
        return steps.map(({ seq: stepSeq, elapsedMs, kind, fields }) => ({ seq: stepSeq, elapsedMs, kind, fields: structuredClone(fields) }));
    }

    async run(id: string): Promise<RescoreRun | null> {
        const run = this.tables.rescoreRuns.find((each) => each.id === id);
        return run === undefined ? null : { ...run };
    }

    async runsFor(key: JobKey): Promise<RescoreRun[]> {
        return this.of(key)
            .sort((a, b) => (b.startedAt > a.startedAt ? 1 : b.startedAt < a.startedAt ? -1 : b.id.localeCompare(a.id)))
            .map((run) => ({ ...run }));
    }

    private of(key: JobKey): RescoreRun[] {
        return this.tables.rescoreRuns.filter((run) => run.ats === key.ats && run.jobId === key.jobId);
    }
}
