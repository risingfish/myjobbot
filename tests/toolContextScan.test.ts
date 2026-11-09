import { expect, test } from "vitest";
import { matchingLines, read, sourceFiles } from "./helpers/sourceScan.js";

const BUILDERS = /function (buildTools|listSourcesTool|nextJobsTool|getJobDetailsTool|finishTool)\(/;
const WHOLE = /\(\s*context:\s*(ToolContext|RunStores\s*&\s*RunPorts\s*&\s*RunIdentity)\s*[,)]/;

test("the run's helpers take the parts of the tool context they read, and the lookup and company search don't know it", () => {
    const scanned = [...sourceFiles("src/tools"), ...sourceFiles("src/sources"), ...sourceFiles("src/companies"), "src/app/beforeAgent.ts"];
    const whole = matchingLines(scanned, WHOLE).filter((hit) => {
        const [path = "", line = "0"] = hit.split(":");
        return !BUILDERS.test(read(path).split("\n")[Number(line) - 1] ?? "");
    });
    const importing = [...sourceFiles("src/companies"), ...sourceFiles("src/careers")].filter((path) => /from "[./]*tools\/context\.js"/.test(read(path)));
    expect([whole, importing]).toEqual([[], []]);
});
