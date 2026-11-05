import { expect, test } from "vitest";
import { settingsForRun } from "../src/app/runSettings.js";
import type { LoadedConfig } from "../src/config/load.js";
import { envSchema } from "../src/config/schema.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { LLM_ENV } from "./helpers/config.js";
import { ONE_COMPANY } from "./helpers/dataDir.js";
import { MemoryResumeStore } from "./helpers/memoryResumeStore.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";
import { memoryTrace } from "./helpers/trace.js";

const ACME = { preferences: "Acme only" };

function loaded(fileRaw: unknown, resume: string | null = "# Jane Doe"): LoadedConfig {
    return { env: envSchema.parse(LLM_ENV), fileRaw, resume, dataDir: "unused" };
}

function stores(searchSettings = new MemorySearchSettingsStore(), resume = new MemoryResumeStore()) {
    return { searchSettings, resume };
}

test("a run with nothing stored uses the defaults, and never imports the file's search settings", async () => {
    const store = new MemorySearchSettingsStore();
    expect((await settingsForRun(loaded(ONE_COMPANY), stores(store), memoryTrace())).settings.preferences).toBe("");
    expect(await store.load(OWNER_ID)).toBeNull();
});

test("with settings stored, a run uses them and traces the file's search settings as ignored and its boards as retired", async () => {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, ACME);
    const trace = memoryTrace();
    const config = await settingsForRun(loaded(ONE_COMPANY), stores(store), trace);
    expect(config.settings.preferences).toBe("Acme only");
    expect(trace.events).toEqual([
        { type: "settings_file_ignored", keys: ["preferences"] },
        { type: "settings_retired", keys: ["companies"] },
    ]);
});

test("a run keeps the settings it started with when the stored ones change", async () => {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, ONE_COMPANY);
    const started = await settingsForRun(loaded(ONE_COMPANY), stores(store), memoryTrace());
    store.put(OWNER_ID, ACME);
    const next = await settingsForRun(loaded(ONE_COMPANY), stores(store), memoryTrace());
    expect([started.settings.preferences, next.settings.preferences]).toEqual(["Remote US, senior backend", "Acme only"]);
});

test("a run with a bad stored match threshold scores with the default and traces the fallback", async () => {
    const store = new MemorySearchSettingsStore();
    store.put(OWNER_ID, { ...ACME, match_threshold: 150 });
    const trace = memoryTrace();
    const config = await settingsForRun(loaded({}), stores(store), trace);
    expect([config.settings.match_threshold, trace.events]).toEqual([70, [{ type: "settings_fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" }]]);
});

test("a run uses the uploaded resume when there is one, and data/resume.md's otherwise", async () => {
    const resume = new MemoryResumeStore();
    expect((await settingsForRun(loaded({}), stores(undefined, resume), memoryTrace())).resume).toBe("# Jane Doe");
    await resume.saveResume(OWNER_ID, { text: "# Uploaded", fileName: "cv.md", fileType: "md", uploadedAt: "2026-11-05T10:00:00.000Z" });
    const config = await settingsForRun(loaded({}), stores(undefined, resume), memoryTrace());
    expect([config.resume, config.settings.preferences]).toEqual(["# Uploaded", ""]);
    expect((await settingsForRun(loaded({}, null), stores(undefined, resume), memoryTrace())).resume).toBe("# Uploaded");
});

test("a run with no uploaded resume and no resume file stops, saying a resume is needed", async () => {
    await expect(settingsForRun(loaded({}, null), stores(), memoryTrace())).rejects.toThrow("No resume: upload one on the Settings page");
});
