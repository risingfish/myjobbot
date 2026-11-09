import { expect, test } from "vitest";
import { MODULES } from "../src/sources/registry.js";
import { matchingLines, read, sourceFiles } from "./helpers/sourceScan.js";

const MODULE_OWNED = [/^src\/sources\/modules\//, /^src\/sources\/hooks\//, /^src\/gmail\//, /^src\/db\/migrations\//];

test("only a source's own module, hook and Gmail code name a source variant in a comparison", () => {
    const ids = [...MODULES.map((module) => module.id), "linkedin"].join("|");
    const comparison = new RegExp(`\\bmodule\\s*[!=]==\\s*["']|\\b(ats|kind)\\s*[!=]==\\s*["'](${ids})["']`);
    const scanned = sourceFiles("src").filter((path) => !MODULE_OWNED.some((owned) => owned.test(path)));
    expect(matchingLines(scanned, comparison)).toEqual([]);
});

test("the shared source code knows nothing of Gmail", () => {
    expect(sourceFiles("src/sources").filter((path) => /^src\/sources\/[^/]+\.ts$/.test(path) && /from "\.\.\/gmail\//.test(read(path)))).toEqual([]);
});

test("the Gmail code knows nothing of the source modules", () => {
    expect(sourceFiles("src/gmail").filter((path) => /from "[./]*sources\/modules\//.test(read(path)))).toEqual([]);
});

test("the rubric reads the settings, not the application config", () => {
    expect(read("src/agent/rubric.ts")).not.toMatch(/AppConfig/);
});
