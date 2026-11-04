import { expect, test } from "vitest";
import { formatVariant, markerProblems, parseVariant, variantName } from "../src/evals/variant.js";
import { rescoreSystemTemplate } from "../src/rescore/prompt.js";

const HEADER = { schema: 1 as const, exportedAt: "2026-11-04T18:00:00.000Z", exportedFrom: "0123456789abcdef", gitCommit: null };

test("a variant's header and body survive writing and reading, the body byte for byte", () => {
    const text = "Line one {data}\n\n  indented {threshold}\n---\n{preferences}\n";
    const parsed = parseVariant(formatVariant({ header: { ...HEADER, gitCommit: "25778fd" }, text }));
    expect(parsed).toEqual({ ok: true, value: { header: { ...HEADER, gitCommit: "25778fd" }, text } });
    expect(parseVariant(formatVariant({ header: HEADER, text })).ok && parseVariant(formatVariant({ header: HEADER, text }))).toMatchObject({ value: { header: { gitCommit: null } } });
});

test("a header without its closing line, with a line that isn't key: value, an unknown key or another format version is refused naming the problem", () => {
    const body = "\n---\ntext";
    const refused = ["schema: 1\nexportedAt: 2026-11-04T18:00:00.000Z\n", `schema: 1\nnot a pair${body}`, `schema: 1\nexportedAt: 2026-11-04T18:00:00.000Z\nexportedFrom: 0123456789abcdef\ngitCommit: null\nextra: 1${body}`, `schema: 2${body}`].map((head) => parseVariant(`---\n${head}`));
    expect(refused).toEqual([
        { ok: false, problem: "no closing --- after the header" },
        { ok: false, problem: "header line 2 isn't key: value" },
        { ok: false, problem: "(root): unrecognized_keys" },
        { ok: false, problem: "needs upgrade (schema 2)" },
    ]);
});

test("a variant's markers must include the data sentence, the threshold and the preferences, and nothing else", () => {
    expect([markerProblems(rescoreSystemTemplate()), markerProblems("{threshold} {preferences} {thresold} {thresold}"), markerProblems("plain text")]).toEqual([[], ["missing {data}", "unknown marker {thresold}"], ["missing {data}", "missing {threshold}", "missing {preferences}"]]);
});

test("a variant name is lowercase letters, digits and dashes, and code is kept for the code's prompt", () => {
    expect(["baseline", "short-rubric-2", "Big One", "a/b", "-lead", "x".repeat(41), "code"].map(variantName)).toEqual([null, null, "variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40", "variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40", "variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40", "variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40", '"code" is kept for the code\'s prompt']);
});
