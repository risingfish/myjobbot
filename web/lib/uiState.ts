import { existsSync } from "node:fs";
import { loadFileConfig } from "../../src/config/load.js";
import type { FileConfig } from "../../src/config/schema.js";
import { openStores } from "../../src/db/connect.js";
import { parseDbSettings, type DbSettings } from "../../src/db/settings.js";
import type { JobViews, Stores } from "../../src/db/store.js";

interface UiState {
    views: JobViews;
    config: FileConfig;
}

const cache = globalThis as typeof globalThis & { __myjobbotStores?: Promise<Stores> };

/** Returns the data folder the web UI reads its config from, from MYJOBBOT_DATA_DIR. */
function dataDir(): string {
    return process.env.MYJOBBOT_DATA_DIR ?? "data";
}

/** Reads the database settings, loading the repository's .env first when there is one (Next.js only reads web/.env). */
function dbSettings(): DbSettings {
    if (existsSync(".env")) process.loadEnvFile(".env");
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
function stores(): Promise<Stores> {
    cache.__myjobbotStores ??= openStores(dbSettings(), { tries: 1 }).catch((error: unknown) => {
        cache.__myjobbotStores = undefined;
        throw error;
    });
    return cache.__myjobbotStores;
}

/** Returns the database views and the freshly loaded file config for one request. */
export async function getUiState(): Promise<UiState> {
    return { views: (await stores()).jobViews, config: loadFileConfig(dataDir()) };
}
