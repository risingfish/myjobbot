import { expect, test } from "vitest";
import { read } from "./helpers/sourceScan.js";

test("the rubric reads the settings, not the application config", () => {
    expect(read("src/agent/rubric.ts")).not.toMatch(/AppConfig/);
});
