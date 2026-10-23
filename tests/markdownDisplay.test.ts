import { expect, test } from "vitest";
import { descriptionHeading, markdownHref } from "../web/lib/markdown.js";

test("a description's links keep web addresses only", () => {
    for (const url of ["https://acme.example/jobs?a=1", "http://acme.example/"]) expect(markdownHref(url)).toBe(url);
    const unsafe = ["javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "%6Aavascript:alert(1)", "data:text/html,x", "vbscript:x", "mailto:a@b.example", "/relative", "#top", "not a url", ""];
    for (const url of unsafe) expect(markdownHref(url)).toBe("");
});

test("a description's headings sit below the panel's own section headings", () => {
    expect([1, 2, 3, 4, 5, 6].map(descriptionHeading)).toEqual(["h4", "h4", "h5", "h6", "h6", "h6"]);
});
