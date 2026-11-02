import type { Trace } from "../agent/trace.js";
import type { RescoreEnd, RescoreLogStore } from "../db/rescoreLogStore.js";
import { describeError } from "../errors.js";
import { parseStep, stepLine, type Step } from "./steps.js";

interface RescoreLogDeps {
    store: RescoreLogStore;
    runId: string;
    startedAt: Date;
    trace: Trace;
    clock: () => Date;
    onLine?: (line: string, elapsedMs: number) => void;
}

export class RescoreLog {
    private seq = 0;
    private written: Promise<void> = Promise.resolve();

    constructor(private readonly deps: RescoreLogDeps) {}

    /** When the run started, the time every step is measured from. */
    get startedAt(): Date {
        return this.deps.startedAt;
    }

    /** Logs one step: numbers it at once, shows its line, and stores it after the steps before it, tracing a failed write instead of failing the re-score. */
    step(entry: Step): void {
        const step = parseStep(entry.kind, entry.fields);
        if (step === null) return;
        this.seq += 1;
        const stored = { seq: this.seq, elapsedMs: this.deps.clock().getTime() - this.deps.startedAt.getTime(), kind: step.kind, fields: step.fields };
        this.deps.onLine?.(stepLine(step), stored.elapsedMs);
        this.written = this.written.then(() => this.deps.store.addStep(this.deps.runId, stored)).catch((error: unknown) => this.failed(error));
    }

    /** Records how the run ended, once every step logged before it is stored. */
    async end(result: RescoreEnd): Promise<void> {
        await this.written;
        await this.deps.store.end(this.deps.runId, result, this.deps.clock().toISOString()).catch((error: unknown) => this.failed(error));
    }

    /** Traces a write to the log that failed. */
    private failed(error: unknown): void {
        this.deps.trace.write({ type: "rescore_log_failed", error: describeError(error) });
    }
}
