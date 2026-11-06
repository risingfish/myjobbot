import { openStores } from "../../src/db/connect.js";
import { parseDbSettings, type DbSettings } from "../../src/db/settings.js";
import type { Stores } from "../../src/db/store.js";
import { loadRepoEnv } from "./env.js";

const cache = globalThis as typeof globalThis & { __myjobbotStores?: Promise<Stores> };

/** Reads the database settings from the environment, the repository's .env loaded first. */
function dbSettings(): DbSettings {
    loadRepoEnv();
    return parseDbSettings(process.env);
}

/** Returns the label the footer shows for the database, without connecting. */
export function dbLabel(): string {
    try {
        const settings = dbSettings();
        return `${settings.database} @ ${settings.host}`;
    } catch {
        return "database not configured";
    }
}

/** Returns the stores, opening them once per server process (and again after a failure) so dev reloads reuse them. */
export function openedStores(): Promise<Stores> {
    cache.__myjobbotStores ??= openStores(dbSettings(), { tries: 1 }).catch((error: unknown) => {
        cache.__myjobbotStores = undefined;
        throw error;
    });
    return cache.__myjobbotStores;
}
