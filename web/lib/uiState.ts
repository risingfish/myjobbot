import { join } from "node:path";
import { loadFileConfig } from "../../src/config/load.js";
import type { FileConfig } from "../../src/config/schema.js";
import { JobViews } from "../../src/db/jobViews.js";
import { openDatabase } from "../../src/db/open.js";

interface UiState {
    views: JobViews;
    config: FileConfig;
    dbPath: string;
}

const cache = globalThis as typeof globalThis & { __myjobbotViews?: JobViews };

/** Returns the data folder the web UI reads, from MYJOBBOT_DATA_DIR. */
function dataDir(): string {
    return process.env.MYJOBBOT_DATA_DIR ?? "data";
}

/** Returns the database path shown in the footer, without reading any file. */
export function dbPath(): string {
    return join(dataDir(), "myjobbot.db");
}

/** Returns the job views, opening the database once per server process so dev reloads reuse it. */
function jobViews(): JobViews {
    cache.__myjobbotViews ??= new JobViews(openDatabase(dbPath()));
    return cache.__myjobbotViews;
}

/** Returns the database views and the freshly loaded file config for one request. */
export function getUiState(): UiState {
    return { views: jobViews(), config: loadFileConfig(dataDir()), dbPath: dbPath() };
}
