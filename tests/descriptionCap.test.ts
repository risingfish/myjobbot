import { expect, test } from "vitest";
import { capDescription } from "../src/descriptions/cap.js";

test("a description within the limit is left alone", () => {
    const text = "a".repeat(20_000);
    expect([capDescription(text, "text"), capDescription(text, "markdown")]).toEqual([text, text]);
});

test("plain text is cut at the limit, and Markdown at the last line break before it", () => {
    const long = `${"a".repeat(19_990)}\n[link](https://example.com/${"x".repeat(50)})`;
    expect(capDescription(long, "text")).toHaveLength(20_000);
    expect(capDescription(long, "markdown")).toBe("a".repeat(19_990));
});
