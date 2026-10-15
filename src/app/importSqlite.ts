import { DatabaseSync } from "node:sqlite";
import type { Insertable, Kysely, Transaction } from "kysely";
import { connectDatabase } from "../db/connect.js";
import type { Database } from "../db/schema.js";
import type { DbSettings } from "../db/settings.js";
import { batches, compareCounts, oversizedValues, sampleIndexes } from "./importPlan.js";

type Table = keyof Database;
type Row = Record<string, unknown>;
type Source = Record<Table, Row[]>;
type Reader = Kysely<Database> | Transaction<Database>;

export interface ImportReport {
    jobs: number;
    verdicts: number;
    api_calls: number;
    hidden: number;
}

const TABLES: Table[] = ["jobs", "verdicts", "api_calls"];
const READS: Record<Table, string> = {
    jobs: "SELECT * FROM jobs ORDER BY ats, job_id",
    verdicts: "SELECT rowid AS id, * FROM verdicts ORDER BY rowid",
    api_calls: "SELECT rowid AS id, * FROM api_calls ORDER BY rowid",
};
const SAMPLE_SIZE = 50;

/** Copies every row of a SQLite database into an empty MariaDB database in one checked transaction, all or nothing. */
export async function importSqlite(path: string, settings: DbSettings): Promise<ImportReport> {
    const source = readSource(path);
    refuseOversized(source);
    const db = await connectDatabase(settings, { tries: 1 });
    try {
        await refuseNonEmpty(db);
        await db.transaction().execute((trx) => copyAll(trx, source));
    } finally {
        await db.destroy();
    }
    return { ...rowCounts(source), hidden: source.jobs.filter((job) => Number(job.hidden) === 1).length } as ImportReport;
}

/** Reads every table of the SQLite file, opened read-only, keeping SQLite's row order. */
function readSource(path: string): Source {
    const sqlite = new DatabaseSync(path, { readOnly: true });
    try {
        return Object.fromEntries(
            TABLES.map((table) => [
                table,
                sqlite
                    .prepare(READS[table])
                    .all()
                    .map((row) => ({ ...row })),
            ]),
        ) as Source;
    } finally {
        sqlite.close();
    }
}

/** Stops the copy, before connecting, if any value would be cut off by its column. */
function refuseOversized(source: Source): void {
    const problems = TABLES.flatMap((table) => source[table].flatMap((row) => oversizedValues(table, row)));
    if (problems.length > 0) throw new Error(`these values don't fit, so nothing was copied:\n${problems.slice(0, 20).join("\n")}`);
}

/** Stops the copy if the target already holds rows, so running it twice can't duplicate anything. */
async function refuseNonEmpty(db: Reader): Promise<void> {
    const counts = await targetCounts(db);
    const filled = Object.entries(counts).filter(([, count]) => count > 0);
    if (filled.length > 0) throw new Error(`target is not empty (${filled.map(([table, count]) => `${table} ${count}`).join(", ")}); nothing was copied`);
}

/** Inserts every row in batches, then checks counts and a sample, throwing (and so rolling back) on any mismatch. */
async function copyAll(trx: Transaction<Database>, source: Source): Promise<void> {
    for (const table of TABLES) {
        for (const batch of batches(source[table], 500))
            await trx
                .insertInto(table)
                .values(batch as Insertable<Database[Table]>[])
                .execute();
    }
    const problems = compareCounts(rowCounts(source), await targetCounts(trx));
    problems.push(...(await sampleMismatches(trx, source)));
    if (problems.length > 0) throw new Error(`the copy didn't match its source, so nothing was copied:\n${problems.join("\n")}`);
}

/** Returns how many rows each table of the source holds. */
function rowCounts(source: Source): Record<Table, number> {
    return Object.fromEntries(TABLES.map((table) => [table, source[table].length])) as Record<Table, number>;
}

/** Counts the rows each MariaDB table holds. */
async function targetCounts(db: Reader): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of TABLES) {
        const row = await db
            .selectFrom(table)
            .select((eb) => eb.fn.countAll().as("count"))
            .executeTakeFirstOrThrow();
        counts[table] = Number(row.count);
    }
    return counts;
}

/** Compares a spread of copied jobs and verdicts with their source rows, field by field. */
async function sampleMismatches(trx: Transaction<Database>, source: Source): Promise<string[]> {
    const problems: string[] = [];
    for (const index of sampleIndexes(source.jobs.length, SAMPLE_SIZE)) {
        const row = source.jobs[index] ?? {};
        const copied = await trx.selectFrom("jobs").selectAll().where("ats", "=", String(row.ats)).where("job_id", "=", String(row.job_id)).executeTakeFirst();
        problems.push(...differences(`jobs ${row.ats}/${row.job_id}`, row, copied));
    }
    for (const index of sampleIndexes(source.verdicts.length, SAMPLE_SIZE)) {
        const row = source.verdicts[index] ?? {};
        const copied = await trx.selectFrom("verdicts").selectAll().where("id", "=", Number(row.id)).executeTakeFirst();
        problems.push(...differences(`verdict ${row.id}`, row, copied));
    }
    return problems;
}

/** Lists the fields where a copied row differs from its source, or notes that it is missing. */
function differences(label: string, source: Row, copied: Row | undefined): string[] {
    if (copied === undefined) return [`${label} is missing`];
    const text = (value: unknown) => (value === null || value === undefined ? null : String(value));
    return Object.keys(source)
        .filter((column) => text(source[column]) !== text(copied[column]))
        .map((column) => `${label}: ${column} differs`);
}
