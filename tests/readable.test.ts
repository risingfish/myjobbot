import { expect, test } from "vitest";
import { readableDescription } from "../src/descriptions/readable.js";

test("a Markdown description keeps each link's words and drops its address", () => {
    const markdown = "Read [our benefits](https://acme.example/benefits) and [apply\nhere](https://acme.example/apply?ref=x%20y).";
    expect(readableDescription(markdown, "markdown")).toBe("Read our benefits and apply\nhere.");
});

test("escaped brackets, an escaped tag and a code span holding a bracket are not links", () => {
    const markdown = "\\[not a link\\](x) and \\<b> and `a](b)` stay";
    expect(readableDescription(markdown, "markdown")).toBe(markdown);
});

test("plain-text descriptions, and ones with no recorded format, are left exactly as they are", () => {
    const text = "See [a](b) and ## not a heading";
    expect([readableDescription(text, "text"), readableDescription(text, null)]).toEqual([text, text]);
});

test("no description stays none", () => {
    expect(readableDescription(null, "markdown")).toBeNull();
});
