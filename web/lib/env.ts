import { existsSync } from "node:fs";

const loaded = globalThis as typeof globalThis & { __myjobbotEnvLoaded?: boolean };

/** Loads the repository's .env once per process, when there is one (Next.js only reads web/.env); keys already set are kept. */
export function loadRepoEnv(): void {
    if (loaded.__myjobbotEnvLoaded) return;
    if (existsSync(".env")) process.loadEnvFile(".env");
    loaded.__myjobbotEnvLoaded = true;
}
