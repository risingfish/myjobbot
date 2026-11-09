import { expect, test } from "vitest";
import { read, sourceFiles } from "./helpers/sourceScan.js";

const appCode = () => [...sourceFiles("src"), ...sourceFiles("web"), ...sourceFiles("tests/helpers")];

test("the owner's id is declared once, and creating the owner's row is written once", () => {
    const declaring = appCode().filter((path) => /export const OWNER_ID\b/.test(read(path)));
    const ensuring = appCode().filter((path) => /export async function ensureOwner/.test(read(path)));
    const ownerRows = sourceFiles("src").filter((path) => path !== "src/db/kysely/owner.ts" && !path.startsWith("src/db/migrations/") && /insertInto\("users"\)\.values\(\{ id:/.test(read(path)));
    expect([declaring, ensuring, ownerRows]).toEqual([["src/db/owner.ts"], ["src/db/kysely/owner.ts"], []]);
});
