import { expect, test } from "vitest";
import { matchingLines, sourceFiles } from "./helpers/sourceScan.js";

test("the web rules take the narrow store parts they use, never a whole store or container", () => {
    expect(matchingLines(sourceFiles("src/web"), /\b\w+\??:\s*(JobViews|UserSourceStore|SourceStore|Stores)\s*[;,)]/)).toEqual([]);
});

test("no code outside the sources decides by a requirement's name", () => {
    const scanned = [...sourceFiles("src"), ...sourceFiles("web")].filter((path) => !path.startsWith("src/sources/"));
    expect(matchingLines(scanned, /[!=]==\s*"(jsearch_key|gmail)"|includes\("(jsearch_key|gmail)"\)/)).toEqual([]);
});
