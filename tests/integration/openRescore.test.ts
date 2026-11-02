import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { openRescore } from "../../src/rescore/open.js";
import { makeDataDir, TEST_ENV } from "../helpers/dataDir.js";
import { memoryStores } from "../helpers/memoryStore.js";

test("opening a re-score reads the data folder, names a new trace file after its run id, and closes without a model call", async () => {
    const dataDir = makeDataDir();
    const opened = await openRescore({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, memoryStores());
    expect(opened.deps.config.resume).toContain("Jane Doe");
    expect(readdirSync(join(dataDir, "runs")).some((name) => name.endsWith(`${opened.deps.runId}.jsonl`))).toBe(true);
    await expect(opened.close()).resolves.toBeUndefined();
});
