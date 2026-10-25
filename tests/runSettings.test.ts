import { expect, test } from "vitest";
import { settingsForRun } from "../src/app/runSettings.js";
import type { LoadedConfig } from "../src/config/load.js";
import { envSchema } from "../src/config/schema.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { LLM_ENV } from "./helpers/config.js";
import { ONE_COMPANY } from "./helpers/dataDir.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";
import { memoryTrace } from "./helpers/trace.js";

const ACME = { companies: [{ name: "Acme", ats: "lever", slug: "acme" }] };

function loaded(fileRaw: unknown): LoadedConfig {
    return { env: envSchema.parse(LLM_ENV), fileRaw, resume: "# Jane Doe", dataDir: "unused" };
}

test("a run's first read imports the file's search settings and traces the import", async () => {
    const trace = memoryTrace();
    const config = await settingsForRun(loaded(ONE_COMPANY), new MemorySearchSettingsStore(), trace);
    expect(config.file.companies.map((company) => company.name)).toEqual(["Stripe"]);
    expect(trace.events).toEqual([{ type: "settings_imported", keys: ["companies", "preferences"] }]);
});

test("with settings stored, a run uses them and traces the file's search settings as ignored", async () => {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, ACME);
    const trace = memoryTrace();
    const config = await settingsForRun(loaded(ONE_COMPANY), store, trace);
    expect(config.file.companies.map((company) => company.name)).toEqual(["Acme"]);
    expect(trace.events).toEqual([{ type: "settings_file_ignored", keys: ["companies", "preferences"] }]);
});

test("a run keeps the settings it started with when the stored ones change", async () => {
    const store = new MemorySearchSettingsStore();
    const started = await settingsForRun(loaded(ONE_COMPANY), store, memoryTrace());
    store.put(OWNER_ID, ACME);
    const next = await settingsForRun(loaded(ONE_COMPANY), store, memoryTrace());
    expect([started.file.companies[0]?.name, next.file.companies[0]?.name]).toEqual(["Stripe", "Acme"]);
});
