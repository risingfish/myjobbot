import { SqliteApiCallLog } from "./apiCalls.js";
import { SqliteJobStore } from "./jobStore.js";
import { SqliteJobViews } from "./jobViews.js";
import { openDatabase } from "./open.js";
import type { Stores } from "./store.js";

/** Opens the SQLite database file at a path and returns the stores that read and write it. */
export function openSqliteStores(path: string): Stores {
    const db = openDatabase(path);
    return {
        jobStore: new SqliteJobStore(db),
        jobViews: new SqliteJobViews(db),
        apiCalls: new SqliteApiCallLog(db),
        close: async () => db.close(),
    };
}
