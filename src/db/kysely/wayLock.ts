import type { Kysely, Transaction } from "kysely";
import { allMethods, keepsAWay } from "../../accounts/methods.js";
import { CARD_KINDS } from "../../accounts/ways/catalog.js";
import type { MethodChange, MethodKind, MethodRow } from "../methodStore.js";
import type { Database } from "../schema.js";

/** Says whether a stored kind is one of the four ways. */
function isKind(kind: string): kind is MethodKind {
    return (CARD_KINDS as readonly string[]).includes(kind);
}

/** Reads the stored ways of an account, through the database or a transaction. */
export async function storedWays(db: Pick<Kysely<Database>, "selectFrom">, userId: number): Promise<MethodRow[]> {
    const rows = await db.selectFrom("sign_in_methods").select(["kind", "enabled", "ready"]).where("user_id", "=", userId).execute();
    return rows.filter((row) => isKind(row.kind)).map((row) => ({ kind: row.kind as MethodKind, enabled: row.enabled === 1, ready: row.ready === 1 }));
}

type Trx = Transaction<Database>;

export interface WayStep {
    change: MethodChange | ((trx: Trx) => Promise<MethodChange | null>);
    apply: (trx: Trx, rows: MethodRow[]) => Promise<void>;
}

/** Makes a change to an account's ways with its row locked, refusing it when it would leave no usable way; a change read under the lock as null leaves the ways as they are. */
export function changeKeepingAWay(db: Kysely<Database>, userId: number, step: WayStep): Promise<"ok" | "last_way"> {
    return db.transaction().execute(async (trx) => {
        await trx.selectFrom("users").select("id").where("id", "=", userId).forUpdate().execute();
        const rows = allMethods(await storedWays(trx, userId));
        const change = typeof step.change === "function" ? await step.change(trx) : step.change;
        if (change !== null && !keepsAWay(rows, change)) return "last_way";
        await step.apply(trx, rows);
        return "ok";
    });
}
