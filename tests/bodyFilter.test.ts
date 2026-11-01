import { expect, test } from "vitest";
import { passesBodyFilter } from "../src/jobs/bodyFilter.js";

const excluding = (...exclude: string[]) => ({ include: [], exclude });
const including = (...include: string[]) => ({ include, exclude: [] });

test("an exclude phrase matches across punctuation and case", () => {
    expect(passesBodyFilter("Active Security-Clearance required", "text", excluding("security clearance"))).toBe(false);
});

test("an exclude term never matches part of a longer word", () => {
    expect(passesBodyFilter("We use PHPUnit", "text", excluding("php"))).toBe(true);
});

test("an exclude term matches a whole word", () => {
    expect(passesBodyFilter("PHP and Go", "text", excluding("php"))).toBe(false);
});

test("a job with no description passes both lists", () => {
    expect(passesBodyFilter(null, null, { include: ["typescript"], exclude: ["clearance"] })).toBe(true);
    expect(passesBodyFilter("", "text", { include: ["typescript"], exclude: ["clearance"] })).toBe(true);
});

test("a Markdown link's words are matched", () => {
    expect(passesBodyFilter("[clearance info](https://x.test/clearance)", "markdown", excluding("clearance"))).toBe(false);
});

test("a Markdown link's address is not matched", () => {
    expect(passesBodyFilter("[apply](https://example.com/jobs)", "markdown", excluding("example"))).toBe(true);
});

test("empty lists pass any description", () => {
    expect(passesBodyFilter("Anything at all", "text", { include: [], exclude: [] })).toBe(true);
});

test("an include list leaves out a description that mentions none of its terms", () => {
    expect(passesBodyFilter("We write Java", "text", including("typescript", "golang"))).toBe(false);
    expect(passesBodyFilter("TypeScript-first team", "text", including("typescript", "golang"))).toBe(true);
});

test("an include term matches whole words only", () => {
    expect(passesBodyFilter("A good team", "text", including("go"))).toBe(false);
});

test("an exclude term wins over an include term", () => {
    expect(passesBodyFilter("TypeScript; clearance required", "text", { include: ["typescript"], exclude: ["clearance"] })).toBe(false);
});
