import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name.startsWith(".next") || entry.name === "node_modules" ? [] : sourceFiles(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

test("nothing in the web app or the run names the owner: every request and run acts for a user it was given", () => {
    const naming = [...sourceFiles("web"), ...sourceFiles("src/app")].filter((path) => readFileSync(path, "utf8").includes("OWNER_ID"));
    expect(naming).toEqual([]);
});
