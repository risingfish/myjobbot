import type { Generated, Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { z } from "zod";

type TablesAtThisStep = {
    user_settings: { user_id: number; settings: unknown; updated_at: string };
    user_sources: { id: Generated<number>; user_id: number; module: string; name: string; params: string; target: string; enabled: number; created_at: string; updated_at: string };
    jobs: { source: string; source_id: number | null };
};

type Db = Kysely<TablesAtThisStep>;

interface MovedSource {
    module: string;
    name: string;
    params: Record<string, unknown>;
    target: string;
}

const ALERTS = { module: "gmail_alerts", name: "Gmail alerts", params: {}, target: "gmail_alerts" };
const board = z.object({ name: z.string().min(1), ats: z.enum(["greenhouse", "lever", "ashby"]), slug: z.string().min(1) });
const search = z.object({ name: z.string().min(1), query: z.string().min(1), remote_only: z.boolean().optional(), country: z.string().min(2).optional() });
const settingsDocument = z.record(z.string(), z.unknown());

/** Moves every user's company boards and saved searches out of their search settings into saved sources, adds their Gmail alerts source, and links their jobs. */
async function up(db: Kysely<unknown>): Promise<void> {
    const typed = db.withTables<TablesAtThisStep>();
    const rows = await typed.selectFrom("user_settings").select(["user_id", "settings"]).orderBy("user_id").execute();
    for (const row of rows) await typed.transaction().execute((trx) => moveUserSources(trx, row.user_id, settingsDocument.parse(row.settings)));
}

/** Moves one user's sources, links their jobs, and takes the sources out of the user's settings document, all in one transaction so a failure leaves the document as it was. */
async function moveUserSources(db: Db, userId: number, document: Record<string, unknown>): Promise<void> {
    const at = new Date().toISOString();
    const ids = new Map<string, number>();
    for (const source of [...documentSources(document), ALERTS]) await addSource(db, { userId, at, ids }, source);
    const { companies: _companies, searches: _searches, ...rest } = document;
    await db.updateTable("user_settings").set({ settings: JSON.stringify(rest) }).where("user_id", "=", userId).execute();
    for (const [name, id] of ids) await db.updateTable("jobs").set({ source_id: id }).where("source", "=", name).where("source_id", "is", null).execute();
}

/** Reads the boards and searches a settings document holds, in its own order, skipping and logging entries no run could use. */
function documentSources(document: Record<string, unknown>): MovedSource[] {
    const boards = usable("companies", document.companies, board).map(({ ats, name, slug }) => ({ module: ats, name, params: { slug }, target: `${ats}:${slug}`.toLowerCase() }));
    return [...boards, ...usable("searches", document.searches, search).map(movedSearch)];
}

/** Keeps a list's entries that pass their rules, logging each other one by its position and, when it has one, its name. */
function usable<T>(list: string, value: unknown, rule: z.ZodType<T>): T[] {
    return entries(value).flatMap((entry, index) => {
        const parsed = rule.safeParse(entry);
        if (parsed.success) return [parsed.data];
        const name = z.object({ name: z.string() }).safeParse(entry);
        console.info(`013_move_sources: skipped ${list}[${index}]${name.success ? ` "${name.data.name}"` : ""}, which no run could use`);
        return [];
    });
}

/** Turns a saved search into a JSearch source, keeping only the fields it had, and points it at its query, country and remote setting as the JSearch module did when this step was written. */
function movedSearch({ name, ...params }: z.infer<typeof search>): MovedSource {
    return { module: "jsearch", name, params, target: `jsearch:${params.query}|${params.country ?? "us"}|${params.remote_only ?? false}`.toLowerCase() };
}

/** Gives a document's list, or none when it holds something else. */
function entries(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

/** Adds one saved source unless its target or name is already taken, in which case its jobs go to the source that took it. */
async function addSource(db: Db, step: { userId: number; at: string; ids: Map<string, number> }, source: MovedSource): Promise<void> {
    const taken = await db.selectFrom("user_sources").select(["id", "name"]).where("user_id", "=", step.userId).where((eb) => eb.or([eb("target", "=", source.target), eb("name", "=", source.name)])).executeTakeFirst();
    if (taken !== undefined) {
        console.info(`013_move_sources: "${source.name}" merged into "${taken.name}"`);
        if (!step.ids.has(source.name)) step.ids.set(source.name, taken.id);
        return;
    }
    const row = { user_id: step.userId, module: source.module, name: source.name, params: JSON.stringify(source.params), target: source.target, enabled: 1, created_at: step.at, updated_at: step.at };
    step.ids.set(source.name, Number((await db.insertInto("user_sources").values(row).executeTakeFirstOrThrow()).insertId));
}

export const moveSources: Migration = { up };
