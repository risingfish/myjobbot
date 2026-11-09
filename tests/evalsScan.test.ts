import { expect, test } from "vitest";
import { matchingLines, sourceFiles } from "./helpers/sourceScan.js";

const ROOTS = ["src/evals/command.ts", "src/resumeProfile/open.ts"];

test("the evals and the resume are handed their clock, randomness, environment, files and child processes", () => {
    const scanned = [...sourceFiles("src/evals"), ...sourceFiles("src/resume"), ...sourceFiles("src/resumeProfile")].filter((path) => !ROOTS.includes(path));
    const reaching = matchingLines(scanned, /\bDate\.now\b|new Date\(\)|\brandomUUID\b|Math\.random|process\.env|\bexecFileSync\b/);
    const files = matchingLines(
        scanned.filter((path) => path !== "src/evals/filePort.ts"),
        /from "node:fs/,
    );
    expect([reaching, files]).toEqual([[], []]);
});

test("only the judge decides by a verdict's name", () => {
    const scanned = sourceFiles("src/evals").filter((path) => path !== "src/evals/judge.ts");
    expect(matchingLines(scanned, /[!=]==\s*"(recommend|borderline|reject|zero)"/)).toEqual([]);
});

test("which resume views there are is listed once", () => {
    const scanned = sourceFiles("src").filter((path) => path !== "src/config/schema.ts" && path !== "src/agent/ownerMessage.ts");
    expect(matchingLines(scanned, /resume_and_profile/)).toEqual([]);
});
