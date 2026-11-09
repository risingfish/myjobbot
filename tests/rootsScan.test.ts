import { expect, expectTypeOf, test } from "vitest";
import type { LookupDeps } from "../src/careers/lookUpJob.js";
import type { CareersStore } from "../src/db/careersStore.js";
import type { JobViews } from "../src/db/jobViews.js";
import type { RescoreDeps } from "../src/rescore/rescore.js";
import { matchingLines, read, sourceFiles } from "./helpers/sourceScan.js";

test("the real IMAP client is chosen only where the app is put together", () => {
    const using = [...sourceFiles("src"), ...sourceFiles("web")].filter((path) => path !== "src/gmail/imap.ts" && !path.startsWith("src/app/") && !path.startsWith("web/lib/") && /\bimapApi\b/.test(read(path)));
    expect(using).toEqual([]);
});

test("accounts don't reach into the Gmail code for sealing secrets", () => {
    const reaching = [...sourceFiles("src/accounts"), "web/lib/authDeps.ts"].filter((path) => /from "[./]*gmail\//.test(read(path)));
    expect(reaching).toEqual([]);
});

test("the careers lookup and re-score are handed their clock", () => {
    const scanned = [...sourceFiles("src/careers"), ...sourceFiles("src/rescore")].filter((path) => path !== "src/rescore/open.ts");
    expect(matchingLines(scanned, /\bDate\.now\b|new Date\(\)/)).toEqual([]);
});

test("the careers lookup and re-score take only the store methods they use", () => {
    expectTypeOf<LookupDeps["careers"]>().toEqualTypeOf<Pick<CareersStore, "careersPage" | "setLookupPage" | "clearLookupPage" | "audit">>();
    expectTypeOf<RescoreDeps["views"]>().toEqualTypeOf<Pick<JobViews, "clearScore">>();
});
