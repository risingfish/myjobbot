import { expect, test } from "vitest";
import { caseId, contentId } from "../src/evals/ids.js";

test("a case is named by its board and job id when the id is a plain word", () => {
    expect([caseId("greenhouse", "4012345"), caseId("linkedin", "li_4486168640"), caseId("lever", "a1-b2")]).toEqual(["greenhouse-4012345", "linkedin-li_4486168640", "lever-a1-b2"]);
});

test("any other job id becomes a stable hash after a double dash, which no plain id can start with", () => {
    const odd = [caseId("workday", "R123/45"), caseId("workday", "-lead"), caseId("x", "a".repeat(81))];
    expect(odd.map((id) => /^[a-z]+--[0-9a-f]{16}$/.test(id))).toEqual([true, true, true]);
    expect(caseId("workday", "R123/45")).toBe(odd[0]);
    expect(new Set(odd).size).toBe(3);
});

test("a content id doesn't depend on key order, and differs when a value does", () => {
    expect(contentId({ a: 1, b: { c: 2, d: [3] } })).toBe(contentId({ b: { d: [3], c: 2 }, a: 1 }));
    expect(contentId({ a: 1 })).not.toBe(contentId({ a: 2 }));
    expect(contentId({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
});
