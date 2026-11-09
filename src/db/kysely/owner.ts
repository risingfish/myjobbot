import type { Transaction } from "kysely";
import { OWNER_ID } from "../owner.js";
import type { Database } from "../schema.js";

/** Creates the owner's user row, unless it exists, when a write is for the owner; any other user must already exist. */
export async function ensureOwnerFor(trx: Transaction<Database>, userId: number, at: string): Promise<void> {
    if (userId !== OWNER_ID) return;
    await trx.insertInto("users").values({ id: OWNER_ID, name: "owner", created_at: at }).onDuplicateKeyUpdate({ id: OWNER_ID }).execute();
}
