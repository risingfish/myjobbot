import type { Kysely, Selectable, Transaction } from "kysely";
import { z } from "zod";
import { openSince, type BeginResult, type RescoreEnd, type RescoreLogStore, type RescoreRun, type StoredStep } from "../rescoreLogStore.js";
import type { Database } from "../schema.js";
import type { JobKey } from "../store.js";

type RunRow = Selectable<Database["rescore_runs"]>;

const outcome = z.enum(["scored", "filtered", "failed"]).nullable();
const filter = z.enum(["company", "title", "body"]).nullable();

export class KyselyRescoreLogStore implements RescoreLogStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Starts a re-score of a job unless one is open, locking the job's row so two presses can't both start one. */
    async begin(key: JobKey, id: string, at: string): Promise<BeginResult> {
        return this.db.transaction().execute(async (trx) => {
            const job = await trx.selectFrom("jobs").select("job_id").where("ats", "=", key.ats).where("job_id", "=", key.jobId).forUpdate().executeTakeFirst();
            if (job === undefined) return { missing: true };
            const open = await openRun(trx, key, at);
            if (open !== undefined) return { running: open.id };
            await trx.insertInto("rescore_runs").values({ id, ats: key.ats, job_id: key.jobId, started_at: at }).execute();
            return { started: id };
        });
    }

    /** Records how a re-score ended and when. */
    async end(id: string, result: RescoreEnd, at: string): Promise<void> {
        await this.db.updateTable("rescore_runs").set({ ended_at: at, outcome: result.outcome, filter: result.filter, score: result.score }).where("id", "=", id).execute();
    }

    /** Stores one step of a re-score, its fields as JSON. */
    async addStep(id: string, step: StoredStep): Promise<void> {
        await this.db
            .insertInto("rescore_steps")
            .values({ run_id: id, seq: step.seq, elapsed_ms: step.elapsedMs, kind: step.kind, fields: JSON.stringify(step.fields) })
            .execute();
    }

    /** Lists a re-score's steps numbered after a step, in order. */
    async stepsAfter(id: string, seq: number): Promise<StoredStep[]> {
        const rows = await this.db.selectFrom("rescore_steps").selectAll().where("run_id", "=", id).where("seq", ">", seq).orderBy("seq").execute();
        return rows.map((row) => ({ seq: row.seq, elapsedMs: row.elapsed_ms, kind: row.kind, fields: JSON.parse(row.fields) as unknown }));
    }

    /** Reads one re-score run, or null when there is none with that id. */
    async run(id: string): Promise<RescoreRun | null> {
        const row = await this.db.selectFrom("rescore_runs").selectAll().where("id", "=", id).executeTakeFirst();
        return row === undefined ? null : rescoreRun(row);
    }

    /** Lists a job's re-score runs, newest first. */
    async runsFor(key: JobKey): Promise<RescoreRun[]> {
        const rows = await this.db.selectFrom("rescore_runs").selectAll().where("ats", "=", key.ats).where("job_id", "=", key.jobId).orderBy("started_at", "desc").orderBy("id", "desc").execute();
        return rows.map(rescoreRun);
    }
}

/** Finds a job's re-score run that is still open and recent enough to block a new one. */
function openRun(trx: Transaction<Database>, key: JobKey, at: string) {
    return trx.selectFrom("rescore_runs").select("id").where("ats", "=", key.ats).where("job_id", "=", key.jobId).where("ended_at", "is", null).where("started_at", ">", openSince(at)).executeTakeFirst();
}

/** Turns a stored run row into the run the app reads. */
function rescoreRun(row: RunRow): RescoreRun {
    return { id: row.id, ats: row.ats, jobId: row.job_id, startedAt: row.started_at, endedAt: row.ended_at, outcome: outcome.parse(row.outcome), filter: filter.parse(row.filter), score: row.score };
}
