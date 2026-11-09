import { expect, test } from "vitest";
import { matchingLines, read, sourceFiles } from "./helpers/sourceScan.js";

test("the web rules take the narrow store parts they use, never a whole store or container", () => {
    expect(matchingLines(sourceFiles("src/web"), /\b\w+\??:\s*(JobViews|UserSourceStore|SourceStore|Stores)\s*[;,)]/)).toEqual([]);
});

test("no code outside the sources decides by a requirement's name", () => {
    const scanned = [...sourceFiles("src"), ...sourceFiles("web")].filter((path) => !path.startsWith("src/sources/"));
    expect(matchingLines(scanned, /[!=]==\s*"(jsearch_key|gmail)"|includes\("(jsearch_key|gmail)"\)/)).toEqual([]);
});

test("only the page rows module decides by a page's name", () => {
    const scanned = [...sourceFiles("web/lib"), ...sourceFiles("web/components")].filter((path) => path !== "web/lib/pageRows.ts");
    expect(matchingLines(scanned, /\b(page|name)\s*[!=]==\s*"(recommended|applied|jobs|reasoning)"/)).toEqual([]);
});

test("server action modules check the session through signedInAction or guarded, never directly", () => {
    const actions = sourceFiles("web/lib").filter((path) => read(path).startsWith('"use server"'));
    expect(matchingLines(actions, /\brequireSession\(/)).toEqual([]);
});

test("the row loaders are handed the time", () => {
    expect(matchingLines(["web/lib/rows.ts", "web/lib/resumeRows.ts"], /new Date\(\)|\bDate\.now\b/)).toEqual([]);
});

test("the data-page loader exports only itself, and no action or source deps reach the Settings loader", () => {
    const exported = [...read("web/lib/uiState.ts").matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((match) => match[1]);
    const reaching = [...sourceFiles("web/lib").filter((path) => /Actions\.ts$/.test(path)), "web/lib/sourceDeps.ts"].filter((path) => /settingsState\.js/.test(read(path)));
    expect([exported, reaching]).toEqual([["getStores", "getUiState"], []]);
});
