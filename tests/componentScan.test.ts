import { expect, test } from "vitest";
import { matchingLines, sourceFiles } from "./helpers/sourceScan.js";

test("no component decides by the search settings' reason texts", () => {
    expect(matchingLines(sourceFiles("web/components"), /"not a search setting"/)).toEqual([]);
});

test("stored times are shown to the minute by one rule", () => {
    const scanned = [...sourceFiles("src"), ...sourceFiles("web")].filter((path) => path !== "src/time/minutes.ts");
    expect(matchingLines(scanned, /slice\(0, 16\)\.replace\("T"/)).toEqual([]);
});
