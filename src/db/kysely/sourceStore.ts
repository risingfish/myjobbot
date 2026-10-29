import { z } from "zod";
import type { Kysely, Selectable, Transaction } from "kysely";
import type { Database } from "../schema.js";
import { OWNER_ID } from "../searchSettingsStore.js";
import { SOURCE_OUTCOMES, type AccountSource, type NewSource, type SavedSource, type SourceKey, type SourceOutcome, type SourceStore } from "../sourceStore.js";
import { ensureOwner } from "./searchSettingsStore.js";

type SourceRow = Selectable<Database["user_sources"]>;

const outcomeName = z.enum(SOURCE_OUTCOMES);

export class KyselySourceStore implements SourceStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Lists a user's saved sources in the order they were added. */
    async list(userId: number): Promise<SavedSource[]> {
        const rows = await this.db.selectFrom("user_sources").selectAll().where("user_id", "=", userId).orderBy("id").execute();
        return rows.map(savedSource);
    }

    /** Adds a new source, or replaces a saved one's fields, relabels its jobs and clears where its fetching stopped; a repeated target or name is refused. */
    async save(userId: number, source: NewSource | SavedSource, at: string): Promise<SavedSource> {
        const fields = sourceFields(source, at);
        const id = await this.db.transaction().execute(async (trx) => {
            if (userId === OWNER_ID) await ensureOwner(trx, at);
            return "id" in source ? replaceSource(trx, { userId, id: source.id }, fields) : insertSource(trx, { ...fields, user_id: userId, created_at: at });
        });
        const saved = (await this.list(userId)).find((each) => each.id === id);
        if (saved === undefined) throw new Error("no such saved source");
        return saved;
    }

    /** Turns a source on or off, so its next fetch starts from its first page. */
    async setEnabled(key: SourceKey, enabled: boolean, at: string): Promise<void> {
        await this.db
            .updateTable("user_sources")
            .set({ enabled: enabled ? 1 : 0, cursor: null, updated_at: at })
            .where("id", "=", key.id)
            .where("user_id", "=", key.userId)
            .execute();
    }

    /** Deletes a saved source; its jobs keep their label and lose their link to it. */
    async remove(key: SourceKey): Promise<void> {
        await this.db.deleteFrom("user_sources").where("id", "=", key.id).where("user_id", "=", key.userId).execute();
    }

    /** Stores how a source's latest fetch went, and where its next fetch starts. */
    async recordFetch(key: SourceKey, outcome: SourceOutcome, cursor: unknown): Promise<void> {
        await this.db
            .updateTable("user_sources")
            .set({ last_fetched_at: outcome.at, last_outcome: outcome.outcome, last_jobs: outcome.jobs, last_cost: outcome.cost, last_reason: outcome.reason, cursor: (cursor ?? null) === null ? null : JSON.stringify(cursor) })
            .where("id", "=", key.id)
            .where("user_id", "=", key.userId)
            .execute();
    }

    /** Links a company-scoped source to its company's record. */
    async linkCompany(key: SourceKey, companyId: number): Promise<void> {
        await this.db.updateTable("user_sources").set({ company_id: companyId }).where("id", "=", key.id).where("user_id", "=", key.userId).execute();
    }

    /** Adds a user's one source of an account-wide module, on, unless they already have it. */
    async ensureAccountSource(userId: number, { module, name }: AccountSource, at: string): Promise<void> {
        const row = { user_id: userId, module, name, params: "{}", target: module, enabled: 1, created_at: at, updated_at: at };
        await this.db.transaction().execute(async (trx) => {
            if (userId === OWNER_ID) await ensureOwner(trx, at);
            await trx
                .insertInto("user_sources")
                .values(row)
                .onDuplicateKeyUpdate((eb) => ({ id: eb.ref("id") }))
                .execute();
        });
    }
}

/** Gives the stored columns of a source's own fields, with its fetching starting over. */
function sourceFields(source: NewSource, at: string) {
    return { module: source.module, name: source.name, params: JSON.stringify(source.params), target: source.target, enabled: source.enabled ? 1 : 0, cursor: null, updated_at: at };
}

/** Adds a new saved source and gives its id. */
async function insertSource(trx: Transaction<Database>, row: ReturnType<typeof sourceFields> & { user_id: number; created_at: string }): Promise<number> {
    return Number((await trx.insertInto("user_sources").values(row).executeTakeFirstOrThrow()).insertId);
}

/** Replaces a saved source's fields and relabels its jobs with its name, giving its id. */
async function replaceSource(trx: Transaction<Database>, key: SourceKey, fields: ReturnType<typeof sourceFields>): Promise<number> {
    await trx.updateTable("user_sources").set(fields).where("id", "=", key.id).where("user_id", "=", key.userId).execute();
    const owned = trx.selectFrom("user_sources").select("id").where("id", "=", key.id).where("user_id", "=", key.userId);
    await trx.updateTable("jobs").set({ source: fields.name }).where("source_id", "in", owned).execute();
    return key.id;
}

/** Turns a stored row into a saved source, with its last fetch when it has had one. */
function savedSource(row: SourceRow): SavedSource {
    const last = row.last_fetched_at === null ? null : lastFetch(row, row.last_fetched_at);
    return { id: row.id, module: row.module, name: row.name, params: row.params, target: row.target, enabled: row.enabled === 1, companyId: row.company_id, cursor: row.cursor ?? null, last };
}

/** Reads how a source's last fetch went from its row. */
function lastFetch(row: SourceRow, at: string): SourceOutcome {
    return { at, outcome: outcomeName.parse(row.last_outcome), jobs: row.last_jobs ?? 0, cost: row.last_cost ?? 0, reason: row.last_reason };
}
