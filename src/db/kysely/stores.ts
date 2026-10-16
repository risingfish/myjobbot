import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { Stores } from "../store.js";
import { KyselyAlertStore } from "./alertStore.js";
import { KyselyApiCallLog } from "./apiCalls.js";
import { KyselyGmailStore } from "./gmailStore.js";
import { KyselyJobStore } from "./jobStore.js";
import { KyselyJobViews } from "./jobViews.js";

/** Returns the stores that read and write a connected database, closing it when the caller is done. */
export function storesOver(db: Kysely<Database>): Stores {
    return { jobStore: new KyselyJobStore(db), jobViews: new KyselyJobViews(db), apiCalls: new KyselyApiCallLog(db), gmail: new KyselyGmailStore(db), alerts: new KyselyAlertStore(db), close: () => db.destroy() };
}
