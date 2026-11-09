import { expect, test } from "vitest";
import { MODULES } from "../src/sources/registry.js";
import { matchingLines, read, sourceFiles } from "./helpers/sourceScan.js";

const appCode = () => [...sourceFiles("src"), ...sourceFiles("web"), ...sourceFiles("tests/helpers")];

const stores = () => [...sourceFiles("src/db").filter((path) => !path.startsWith("src/db/migrations/")), ...sourceFiles("tests/helpers").filter((path) => /\/memory\w*\.ts$/.test(path))];

test("the owner's id is declared once, and creating the owner's row is written once", () => {
    const declaring = appCode().filter((path) => /export const OWNER_ID\b/.test(read(path)));
    const ensuring = appCode().filter((path) => /export async function ensureOwner/.test(read(path)));
    const ownerRows = sourceFiles("src").filter((path) => path !== "src/db/kysely/owner.ts" && !path.startsWith("src/db/migrations/") && /insertInto\("users"\)\.values\(\{ id:/.test(read(path)));
    expect([declaring, ensuring, ownerRows]).toEqual([["src/db/owner.ts"], ["src/db/kysely/owner.ts"], []]);
});

test("no store decides by a source module's id which jobs are board postings", () => {
    const ids = [...MODULES.map((module) => module.id), "linkedin"].join("|");
    const comparison = new RegExp(`[!=]==\\s*"(${ids})"|"not in", \\[[^\\]]*"(${ids})"`);
    expect(matchingLines(stores(), comparison)).toEqual([]);
});

test("no store branches on an emailed link's purpose by name", () => {
    expect(matchingLines(stores(), /[!=]==\s*"(signin|reset|email_change|step_up)"/)).toEqual([]);
});
