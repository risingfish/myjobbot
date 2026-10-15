import { expect, test } from "vitest";
import { shortTitle } from "../src/web/shortTitle.js";

test("a short title is returned unchanged", () => {
    expect(shortTitle("Senior Engineer")).toBe("Senior Engineer");
});

test("a title of exactly the limit is returned unchanged", () => {
    const title = "x".repeat(64);
    expect(shortTitle(title)).toBe(title);
});

test("a title over the limit keeps its first 64 characters and ends in an ellipsis", () => {
    expect(shortTitle("y".repeat(65))).toBe(`${"y".repeat(64)}…`);
});

test("a cut that ends on a space drops the space before the ellipsis", () => {
    const title = `${"a".repeat(63)} rest of the title`;
    expect(shortTitle(title)).toBe(`${"a".repeat(63)}…`);
});

test("emoji and accented letters count as one character each and are never split", () => {
    const emoji = "👩‍💻".repeat(70);
    expect(shortTitle(emoji)).toBe(`${"👩‍💻".repeat(64)}…`);
    const accented = "é".repeat(70);
    expect(shortTitle(accented)).toBe(`${"é".repeat(64)}…`);
});
