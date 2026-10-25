import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadConfig, loadFileConfig } from "../src/config/load.js";
import { SAMPLE_CONFIG } from "./helpers/config.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";

test("loadConfig and loadFileConfig read config.json raw and resume.md from the data directory", () => {
    const dir = makeDataDir();
    expect(loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toMatchObject({ fileRaw: SAMPLE_CONFIG, resume: expect.stringContaining("Jane Doe"), dataDir: dir });
    expect(loadFileConfig(dir)).toEqual(SAMPLE_CONFIG);
});

test("loadConfig asks to convert a leftover config.yaml", () => {
    const dir = makeDataDir();
    rmSync(join(dir, "config.json"));
    writeFileSync(join(dir, "config.yaml"), "companies: []\n");
    expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/config is now JSON: convert .*config.yaml to .*config.json/);
});
