import { expect, test } from "vitest";
import { lineDiff } from "../src/evals/lineDiff.js";

const lines = Array.from({ length: 50 }, (_, index) => `line ${index + 1}`);

test("two edited lines among fifty show as one group of only those lines, and identical texts show none", () => {
    const edited = lines.map((line, index) => (index === 13 ? "line 14, stricter" : index === 14 ? "line 15, stricter" : line));
    expect(lineDiff(lines.join("\n"), edited.join("\n"))).toEqual(["@@ line 14", "- line 14", "- line 15", "+ line 14, stricter", "+ line 15, stricter"]);
    expect(lineDiff(lines.join("\n"), lines.join("\n"))).toEqual([]);
});

test("a line removed at the start and one added at the end each show alone", () => {
    const changed = [...lines.slice(1), "line 51"];
    expect(lineDiff(lines.join("\n"), changed.join("\n"))).toEqual(["@@ line 1", "- line 1", "@@ line 51", "+ line 51"]);
});
